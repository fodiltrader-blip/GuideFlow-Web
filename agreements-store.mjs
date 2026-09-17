import { AgreementError, normalizeAgreement, newIdentity, publication, validId } from './agreements-core.mjs';
export const REGISTRY_PATH = 'config/purchase-agreements.json';
const SOURCE = 'GuideFlow';
const WEB = 'GuideFlow-Web';
const pathFor = id => { if (!validId(id)) throw new AgreementError('invalid'); return `data/agreements/${id}.json`; };
export function createAgreementStore({ readJsonOrNull, putFile }) {
  async function registry() {
    const file = await readJsonOrNull(SOURCE, REGISTRY_PATH);
    if (file && (file.json.version !== 1 || !Array.isArray(file.json.entries))) throw new AgreementError('invalid');
    return file || { sha: null, json: { version: 1, entries: [] } };
  }
  return {
    async list() {
      return (await registry()).json.entries.map(record => {
        if (!validId(record.id) || !Number.isInteger(record.revision) || record.revision < 1) throw new AgreementError('invalid');
        const document = normalizeAgreement(record.document);
        if (document.visibility === 'private' && !/^[\w-]{43}$/.test(record.shareKey || '')) throw new AgreementError('invalid');
        return { ...record, document };
      });
    },
    async save(input, previous) {
      const document = normalizeAgreement(input);
      const latest = await registry();
      const existing = previous && latest.json.entries.find(entry => entry.id === previous.id);
      if (previous && (!existing || existing.revision !== previous.revision)) throw new AgreementError('conflict');
      // Public history cannot become private by toggling a setting. Create another agreement instead.
      if (existing && existing.document.visibility !== document.visibility) throw new AgreementError('visibility');
      const identity = existing || newIdentity();
      const record = { id: identity.id, ...(document.visibility === 'private' ? { shareKey: identity.shareKey } : {}), document, revision: (existing?.revision || 0) + 1, updatedAt: new Date().toISOString() };
      const entries = latest.json.entries.filter(entry => entry.id !== record.id).concat(record);
      await putFile(SOURCE, REGISTRY_PATH, JSON.stringify({ version: 1, entries }, null, 2) + '\n', `Save purchase agreement ${record.id}`, latest.sha);
      return record;
    },
    async publish(record) {
      const path = pathFor(record.id);
      // Read public SHA first. A concurrent publication must cause a conflict, never a silent overwrite.
      const current = await readJsonOrNull(WEB, path);
      const latest = (await registry()).json.entries.find(entry => entry.id === record.id);
      if (!latest || latest.revision !== record.revision) throw new AgreementError('conflict');
      if (current?.json.revision === record.revision) return;
      if (current && current.json.revision > record.revision) throw new AgreementError('conflict');
      const body = await publication(latest);
      await putFile(WEB, path, JSON.stringify(body, null, 2) + '\n', `Publish purchase agreement ${record.id} revision ${record.revision}`, current?.sha || null);
    }
  };
}
