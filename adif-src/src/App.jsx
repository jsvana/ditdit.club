import React, { useState, useCallback, useMemo, useRef } from 'react';
import { parseAdif } from './parser.js';
import { validateAdif, generateSummary, SEV } from './validator.js';
import { FIELD_DEFS, KNOWN_APP_PROGRAMS, BANDS } from './adifData.js';

// ─── Color palette matching ditdit.club ───
const C = {
  bg: '#FAF8F5', cream: '#FAF8F5', black: '#1a1a1a',
  pink: '#E87A9F', pinkDark: '#D4587D',
  gray: '#6B6B6B', grayLight: '#E8E6E3', grayLighter: '#F2F0ED',
  white: '#FFFFFF',
  red: '#D94452', redBg: '#FDF0F0',
  orange: '#C67D2A', orangeBg: '#FEF7EC',
  blue: '#3B82C4', blueBg: '#EEF4FB',
  green: '#2E8B57', greenBg: '#EEFAF3',
};

const font = "'Space Grotesk', sans-serif";
const mono = "'IBM Plex Mono', 'JetBrains Mono', monospace";

// ─── Styles ───
const styles = {
  app: {
    fontFamily: font, background: C.bg, color: C.black,
    minHeight: '100vh', lineHeight: 1.5,
  },
  container: { maxWidth: 1100, margin: '0 auto', padding: '1.5rem' },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '1rem 0 1.5rem', borderBottom: `2px solid ${C.black}`,
    marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.5rem',
  },
  title: {
    fontFamily: "'Archivo Black', sans-serif", fontSize: 'clamp(1.4rem, 4vw, 2rem)',
    fontWeight: 900, letterSpacing: '-0.02em',
  },
  titleAccent: { color: C.pinkDark },
  homeLink: {
    fontFamily: mono, fontSize: '0.85rem', color: C.gray,
    textDecoration: 'none', border: `1px solid ${C.grayLight}`,
    padding: '0.35rem 0.75rem', borderRadius: 4,
  },
  dropZone: {
    border: `2px dashed ${C.grayLight}`, borderRadius: 8,
    padding: '3rem 2rem', textAlign: 'center', cursor: 'pointer',
    transition: 'all 0.2s',
  },
  dropZoneActive: {
    borderColor: C.pink, background: '#fdf2f6',
  },
  dropZoneLoaded: {
    borderColor: C.green, borderStyle: 'solid', background: C.greenBg,
    padding: '1rem 2rem',
  },
  dropLabel: { fontSize: '1.1rem', fontWeight: 600, marginBottom: '0.5rem' },
  dropSub: { fontSize: '0.85rem', color: C.gray },
  section: { marginTop: '1.5rem' },
  sectionTitle: {
    fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem',
    borderBottom: `1px solid ${C.grayLight}`, paddingBottom: '0.4rem',
    display: 'flex', alignItems: 'center', gap: '0.5rem',
  },
  card: {
    background: C.white, border: `1px solid ${C.grayLight}`,
    borderRadius: 6, padding: '1rem', marginBottom: '0.75rem',
  },
  statGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
    gap: '0.75rem',
  },
  stat: {
    background: C.white, border: `1px solid ${C.grayLight}`, borderRadius: 6,
    padding: '0.75rem', textAlign: 'center',
  },
  statValue: { fontSize: '1.5rem', fontWeight: 700, fontFamily: mono },
  statLabel: { fontSize: '0.75rem', color: C.gray, textTransform: 'uppercase', letterSpacing: '0.05em' },
  badge: {
    display: 'inline-block', fontSize: '0.7rem', fontWeight: 600,
    padding: '0.15rem 0.5rem', borderRadius: 10, fontFamily: mono,
  },
  filterBar: {
    display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '0.75rem',
  },
  filterBtn: {
    border: `1px solid ${C.grayLight}`, background: C.white, borderRadius: 4,
    padding: '0.3rem 0.7rem', fontSize: '0.8rem', cursor: 'pointer',
    fontFamily: font, fontWeight: 500, transition: 'all 0.15s',
  },
  filterBtnActive: { background: C.black, color: C.white, borderColor: C.black },
  issue: {
    display: 'flex', gap: '0.6rem', padding: '0.5rem 0.7rem',
    borderRadius: 4, marginBottom: '0.35rem', fontSize: '0.85rem',
    alignItems: 'flex-start', fontFamily: mono,
  },
  issueSev: { fontWeight: 700, flexShrink: 0, fontSize: '0.7rem', marginTop: '0.15rem' },
  issueField: { fontWeight: 600 },
  issueMsg: { flex: 1 },
  issueRec: { color: C.gray, flexShrink: 0, fontSize: '0.75rem' },
  recordCard: {
    background: C.white, border: `1px solid ${C.grayLight}`, borderRadius: 6,
    marginBottom: '0.5rem', overflow: 'hidden',
  },
  recordHeader: {
    padding: '0.6rem 1rem', cursor: 'pointer', display: 'flex',
    justifyContent: 'space-between', alignItems: 'center',
    fontWeight: 600, fontSize: '0.9rem', userSelect: 'none',
  },
  recordHeaderHover: { background: C.grayLighter },
  fieldTable: {
    width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: mono,
  },
  th: {
    textAlign: 'left', padding: '0.4rem 0.8rem', borderBottom: `1px solid ${C.grayLight}`,
    fontFamily: font, fontWeight: 600, fontSize: '0.75rem', color: C.gray,
    textTransform: 'uppercase', letterSpacing: '0.04em',
  },
  td: {
    padding: '0.35rem 0.8rem', borderBottom: `1px solid ${C.grayLighter}`,
    verticalAlign: 'top',
  },
  extSection: {
    background: C.blueBg, border: `1px solid ${C.blue}33`, borderRadius: 6,
    padding: '1rem', marginBottom: '0.75rem',
  },
  headerField: {
    display: 'flex', gap: '0.75rem', padding: '0.3rem 0', fontSize: '0.85rem',
    fontFamily: mono,
  },
  headerFieldName: { fontWeight: 600, minWidth: 160, color: C.gray },
  tabs: {
    display: 'flex', gap: 0, borderBottom: `2px solid ${C.grayLight}`,
    marginBottom: '1rem', overflow: 'auto',
  },
  tab: {
    padding: '0.6rem 1.2rem', cursor: 'pointer', fontSize: '0.9rem',
    fontWeight: 600, fontFamily: font, border: 'none', background: 'none',
    borderBottom: '2px solid transparent', marginBottom: -2,
    color: C.gray, transition: 'all 0.15s', whiteSpace: 'nowrap',
  },
  tabActive: { color: C.black, borderBottomColor: C.pinkDark },
};

const sevColors = {
  [SEV.ERROR]:   { bg: C.redBg, color: C.red, label: 'ERR' },
  [SEV.WARNING]: { bg: C.orangeBg, color: C.orange, label: 'WARN' },
  [SEV.INFO]:    { bg: C.blueBg, color: C.blue, label: 'INFO' },
};

// ─── Components ───

function Badge({ severity, count }) {
  const c = sevColors[severity];
  return (
    <span style={{ ...styles.badge, background: c.bg, color: c.color }}>
      {c.label}{count !== undefined ? ` ${count}` : ''}
    </span>
  );
}

function SummaryPanel({ summary }) {
  const fmtDate = d => d ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : '—';
  const bandList = Object.entries(summary.bands).sort((a,b) => {
    const aInfo = BANDS[a[0].toLowerCase()];
    const bInfo = BANDS[b[0].toLowerCase()];
    return (aInfo?.lower || 0) - (bInfo?.lower || 0);
  });

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Summary</div>
      <div style={styles.statGrid}>
        <div style={styles.stat}>
          <div style={styles.statValue}>{summary.totalRecords}</div>
          <div style={styles.statLabel}>QSO Records</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statValue}>{summary.callsigns.size}</div>
          <div style={styles.statLabel}>Unique Calls</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statValue}>{Object.keys(summary.bands).length}</div>
          <div style={styles.statLabel}>Bands</div>
        </div>
        <div style={styles.stat}>
          <div style={styles.statValue}>{Object.keys(summary.modes).length}</div>
          <div style={styles.statLabel}>Modes</div>
        </div>
      </div>
      <div style={{ ...styles.card, marginTop: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.85rem' }}>
          <div>
            <strong>Date range:</strong> {fmtDate(summary.dateRange.earliest)}
            {summary.dateRange.earliest !== summary.dateRange.latest && ` to ${fmtDate(summary.dateRange.latest)}`}
          </div>
          {summary.programId && (
            <div><strong>Program:</strong> {summary.programId}{summary.programVersion ? ` v${summary.programVersion}` : ''}</div>
          )}
          {summary.adifVersion && (
            <div><strong>ADIF version:</strong> {summary.adifVersion}</div>
          )}
          <div style={{ gridColumn: '1 / -1' }}>
            <strong>Bands:</strong>{' '}
            {bandList.map(([b, cnt]) => (
              <span key={b} style={{ ...styles.badge, background: C.grayLighter, color: C.black, marginRight: 4, marginBottom: 2 }}>
                {b} ({cnt})
              </span>
            ))}
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <strong>Modes:</strong>{' '}
            {Object.entries(summary.modes).sort((a,b) => b[1]-a[1]).map(([m, cnt]) => (
              <span key={m} style={{ ...styles.badge, background: C.grayLighter, color: C.black, marginRight: 4, marginBottom: 2 }}>
                {m} ({cnt})
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ValidationPanel({ issues }) {
  const [filter, setFilter] = useState('all');
  const [catFilter, setCatFilter] = useState('all');

  const counts = useMemo(() => {
    const c = { error: 0, warning: 0, info: 0 };
    for (const i of issues) c[i.severity] = (c[i.severity] || 0) + 1;
    return c;
  }, [issues]);

  const categories = useMemo(() => {
    const cats = new Set();
    for (const i of issues) cats.add(i.category);
    return [...cats].sort();
  }, [issues]);

  const filtered = useMemo(() =>
    issues.filter(i =>
      (filter === 'all' || i.severity === filter) &&
      (catFilter === 'all' || i.category === catFilter)
    ),
    [issues, filter, catFilter]
  );

  if (issues.length === 0) {
    return (
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Validation Results</div>
        <div style={{ ...styles.card, background: C.greenBg, borderColor: `${C.green}33`, textAlign: 'center' }}>
          <span style={{ fontSize: '1.2rem', fontWeight: 600, color: C.green }}>
            No issues found
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>
        Validation Results
        <span style={{ fontWeight: 400, fontSize: '0.85rem', color: C.gray }}>({issues.length} total)</span>
      </div>

      <div style={styles.filterBar}>
        {[
          { key: 'all', label: `All (${issues.length})` },
          { key: 'error', label: `Errors (${counts.error})` },
          { key: 'warning', label: `Warnings (${counts.warning})` },
          { key: 'info', label: `Info (${counts.info})` },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ ...styles.filterBtn, ...(filter === f.key ? styles.filterBtnActive : {}) }}>
            {f.label}
          </button>
        ))}
        <span style={{ width: 1, background: C.grayLight, margin: '0 0.3rem' }} />
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ ...styles.filterBtn, appearance: 'auto', paddingRight: '0.5rem' }}>
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div style={{ maxHeight: 500, overflowY: 'auto', border: `1px solid ${C.grayLight}`, borderRadius: 6 }}>
        {filtered.map((issue, idx) => {
          const sc = sevColors[issue.severity];
          return (
            <div key={idx} style={{ ...styles.issue, background: idx % 2 ? C.white : C.grayLighter }}>
              <span style={{ ...styles.issueSev, color: sc.color }}>{sc.label}</span>
              {issue.record && <span style={styles.issueRec}>R{issue.record}</span>}
              {issue.field && <span style={styles.issueField}>{issue.field}</span>}
              <span style={styles.issueMsg}>{issue.message}</span>
              <span style={{ ...styles.badge, background: `${sc.color}18`, color: sc.color, fontSize: '0.65rem' }}>
                {issue.category}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeaderView({ header }) {
  if (!header) return null;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Header</div>
      <div style={styles.card}>
        {header.freeText && (
          <div style={{ marginBottom: '0.75rem', padding: '0.5rem', background: C.grayLighter, borderRadius: 4, fontSize: '0.82rem', fontFamily: mono, whiteSpace: 'pre-wrap' }}>
            {header.freeText}
          </div>
        )}
        {header.fields.map((f, i) => (
          <div key={i} style={styles.headerField}>
            <span style={styles.headerFieldName}>{f.name}</span>
            <span>{f.value || <em style={{ color: C.gray }}>(empty)</em>}</span>
          </div>
        ))}
        {header.userDefs.length > 0 && (
          <>
            <div style={{ marginTop: '0.75rem', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.4rem' }}>
              User-Defined Fields
            </div>
            {header.userDefs.map((ud, i) => (
              <div key={i} style={styles.headerField}>
                <span style={styles.headerFieldName}>USERDEF{ud.id}: {ud.fieldName}</span>
                <span>
                  {ud.typeIndicator && `Type: ${ud.typeIndicator}`}
                  {ud.enumValues && ` Values: {${ud.enumValues.join(', ')}}`}
                  {ud.range && ` Range: ${ud.range.min} - ${ud.range.max}`}
                </span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function ExtensionsPanel({ extensions, programInfo }) {
  const appPrograms = Object.keys(extensions.appFields);
  const hasExtensions = appPrograms.length > 0 || extensions.userDefFields.length > 0 || extensions.unknownFields.length > 0;

  if (!hasExtensions) return null;

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>Extensions &amp; Non-Standard Fields</div>

      {appPrograms.length > 0 && (
        <div style={styles.extSection}>
          <div style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '0.9rem' }}>
            Application Fields (APP_*)
          </div>
          {appPrograms.map(prog => {
            const known = KNOWN_APP_PROGRAMS[prog];
            const fields = [...extensions.appFields[prog]].sort();
            return (
              <div key={prog} style={{ marginBottom: '0.5rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', fontFamily: mono }}>
                  APP_{prog}_*
                  {known && <span style={{ fontWeight: 400, color: C.gray, marginLeft: 8 }}>({known})</span>}
                </div>
                <div style={{ fontSize: '0.8rem', fontFamily: mono, paddingLeft: '1rem', color: C.gray }}>
                  {fields.map(f => `APP_${prog}_${f}`).join(', ')}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {extensions.userDefFields.length > 0 && (
        <div style={{ ...styles.extSection, background: C.greenBg, borderColor: `${C.green}33` }}>
          <div style={{ fontWeight: 700, marginBottom: '0.3rem', fontSize: '0.9rem' }}>User-Defined Fields</div>
          <div style={{ fontSize: '0.85rem', fontFamily: mono }}>
            {extensions.userDefFields.join(', ')}
          </div>
        </div>
      )}

      {extensions.unknownFields.length > 0 && (
        <div style={{ ...styles.extSection, background: C.orangeBg, borderColor: `${C.orange}33` }}>
          <div style={{ fontWeight: 700, marginBottom: '0.3rem', fontSize: '0.9rem' }}>Unknown Fields</div>
          <div style={{ fontSize: '0.85rem', fontFamily: mono }}>
            {extensions.unknownFields.join(', ')}
          </div>
          <div style={{ fontSize: '0.78rem', color: C.gray, marginTop: '0.3rem' }}>
            These fields are not in the ADIF specification and are not APP_* or USERDEF fields.
          </div>
        </div>
      )}
    </div>
  );
}

function RecordRow({ field, recordIssues }) {
  const fieldIssues = recordIssues.filter(i => i.field === field.name);
  const hasError = fieldIssues.some(i => i.severity === SEV.ERROR);
  const hasWarning = fieldIssues.some(i => i.severity === SEV.WARNING);
  const def = FIELD_DEFS[field.name];
  const bgColor = hasError ? C.redBg : hasWarning ? C.orangeBg : 'transparent';

  return (
    <tr style={{ background: bgColor }}>
      <td style={{ ...styles.td, fontWeight: 600 }}>{field.name}</td>
      <td style={{ ...styles.td, maxWidth: 400, wordBreak: 'break-all' }}>
        {field.value || <em style={{ color: C.gray }}>(empty)</em>}
        {field.lengthMismatch && (
          <span style={{ ...styles.badge, background: C.redBg, color: C.red, marginLeft: 6 }}>
            len:{field.declaredLength} actual:{field.actualLength}
          </span>
        )}
      </td>
      <td style={{ ...styles.td, fontSize: '0.75rem', color: C.gray }}>
        {field.typeIndicator || (def ? def.type : '')}
      </td>
      <td style={{ ...styles.td, fontSize: '0.78rem', color: C.gray }}>
        {def ? def.desc : field.name.startsWith('APP_') ? 'Application field' : ''}
      </td>
      <td style={{ ...styles.td, width: 40 }}>
        {fieldIssues.map((iss, j) => (
          <div key={j} title={iss.message}>
            <Badge severity={iss.severity} />
          </div>
        ))}
      </td>
    </tr>
  );
}

function RecordCard({ record, issues }) {
  const [open, setOpen] = useState(false);
  const recNum = record.index + 1;
  const recordIssues = issues.filter(i => i.record === recNum);
  const errCount = recordIssues.filter(i => i.severity === SEV.ERROR).length;
  const warnCount = recordIssues.filter(i => i.severity === SEV.WARNING).length;

  const callField = record.fields.find(f => f.name === 'CALL');
  const bandField = record.fields.find(f => f.name === 'BAND');
  const modeField = record.fields.find(f => f.name === 'MODE');
  const dateField = record.fields.find(f => f.name === 'QSO_DATE');

  const preview = [
    callField?.value,
    bandField?.value,
    modeField?.value,
    dateField?.value,
  ].filter(Boolean).join(' / ');

  return (
    <div style={styles.recordCard}>
      <div style={styles.recordHeader} onClick={() => setOpen(!open)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span>{open ? '\u25BC' : '\u25B6'}</span>
          <span>Record {recNum}</span>
          <span style={{ color: C.gray, fontWeight: 400, fontSize: '0.82rem', fontFamily: mono }}>
            {preview}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {errCount > 0 && <Badge severity={SEV.ERROR} count={errCount} />}
          {warnCount > 0 && <Badge severity={SEV.WARNING} count={warnCount} />}
          <span style={{ ...styles.badge, background: C.grayLighter, color: C.gray }}>
            {record.fields.length} fields
          </span>
        </div>
      </div>
      {open && (
        <div style={{ padding: '0 1rem 0.5rem', overflowX: 'auto' }}>
          {recordIssues.length > 0 && (
            <div style={{ marginBottom: '0.5rem' }}>
              {recordIssues.map((iss, i) => {
                const sc = sevColors[iss.severity];
                return (
                  <div key={i} style={{ fontSize: '0.8rem', padding: '0.2rem 0.4rem', background: sc.bg, borderRadius: 3, marginBottom: 2, fontFamily: mono }}>
                    <span style={{ fontWeight: 700, color: sc.color }}>{sc.label}</span>
                    {iss.field && <span style={{ fontWeight: 600 }}> {iss.field}:</span>}
                    {' '}{iss.message}
                  </div>
                );
              })}
            </div>
          )}
          <table style={styles.fieldTable}>
            <thead>
              <tr>
                <th style={styles.th}>Field</th>
                <th style={styles.th}>Value</th>
                <th style={styles.th}>Type</th>
                <th style={styles.th}>Description</th>
                <th style={styles.th}></th>
              </tr>
            </thead>
            <tbody>
              {record.fields.map((f, i) => (
                <RecordRow key={i} field={f} recordIssues={recordIssues} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function RecordsPanel({ records, issues }) {
  const [page, setPage] = useState(0);
  const perPage = 50;
  const totalPages = Math.ceil(records.length / perPage);
  const pageRecords = records.slice(page * perPage, (page + 1) * perPage);

  // Filter controls
  const [search, setSearch] = useState('');
  const [onlyIssues, setOnlyIssues] = useState(false);

  const filteredRecords = useMemo(() => {
    let recs = pageRecords;
    if (search) {
      const q = search.toUpperCase();
      recs = recs.filter(r => r.fields.some(f =>
        f.name.includes(q) || f.value.toUpperCase().includes(q)
      ));
    }
    if (onlyIssues) {
      recs = recs.filter(r => issues.some(i => i.record === r.index + 1));
    }
    return recs;
  }, [pageRecords, search, onlyIssues, issues]);

  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>
        Records
        <span style={{ fontWeight: 400, fontSize: '0.85rem', color: C.gray }}>({records.length} total)</span>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text" placeholder="Search fields or values..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 200, padding: '0.4rem 0.7rem', border: `1px solid ${C.grayLight}`,
            borderRadius: 4, fontFamily: font, fontSize: '0.85rem', background: C.white,
          }}
        />
        <label style={{ fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={onlyIssues} onChange={e => setOnlyIssues(e.target.checked)} />
          Only records with issues
        </label>
      </div>

      {filteredRecords.map(record => (
        <RecordCard key={record.index} record={record} issues={issues} />
      ))}

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem', marginTop: '1rem', alignItems: 'center' }}>
          <button onClick={() => setPage(0)} disabled={page === 0}
            style={{ ...styles.filterBtn, ...(page === 0 ? { opacity: 0.4 } : {}) }}>&laquo;</button>
          <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
            style={{ ...styles.filterBtn, ...(page === 0 ? { opacity: 0.4 } : {}) }}>&lsaquo;</button>
          <span style={{ fontSize: '0.85rem', padding: '0 0.5rem' }}>
            Page {page + 1} of {totalPages}
          </span>
          <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
            style={{ ...styles.filterBtn, ...(page >= totalPages - 1 ? { opacity: 0.4 } : {}) }}>&rsaquo;</button>
          <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}
            style={{ ...styles.filterBtn, ...(page >= totalPages - 1 ? { opacity: 0.4 } : {}) }}>&raquo;</button>
        </div>
      )}
    </div>
  );
}

function ProgramChecksPanel({ programInfo }) {
  if (!programInfo.id) return null;
  const known = KNOWN_APP_PROGRAMS[programInfo.id.toUpperCase()];
  return (
    <div style={{ ...styles.card, background: C.blueBg, borderColor: `${C.blue}33` }}>
      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
        Generated by: {programInfo.id}
        {programInfo.version && ` v${programInfo.version}`}
        {known && <span style={{ fontWeight: 400, color: C.gray }}> ({known})</span>}
      </div>
    </div>
  );
}

// ─── Main App ───

export default function App() {
  const [parsed, setParsed] = useState(null);
  const [validation, setValidation] = useState(null);
  const [summary, setSummary] = useState(null);
  const [fileName, setFileName] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [activeTab, setActiveTab] = useState('validation');
  const fileRef = useRef();

  const processFile = useCallback((file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const p = parseAdif(text);
      const v = validateAdif(p);
      const s = generateSummary(p);
      setParsed(p);
      setValidation(v);
      setSummary(s);
      setActiveTab('validation');
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const onFileChange = useCallback((e) => {
    processFile(e.target.files?.[0]);
  }, [processFile]);

  const reset = useCallback(() => {
    setParsed(null);
    setValidation(null);
    setSummary(null);
    setFileName(null);
  }, []);

  const errCount = validation ? validation.issues.filter(i => i.severity === SEV.ERROR).length : 0;
  const warnCount = validation ? validation.issues.filter(i => i.severity === SEV.WARNING).length : 0;
  const infoCount = validation ? validation.issues.filter(i => i.severity === SEV.INFO).length : 0;

  return (
    <div style={styles.app}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.title}>
            ADIF <span style={styles.titleAccent}>Validator</span>
          </div>
          <a href="/" style={styles.homeLink}>ditdit.club</a>
        </div>

        {/* File upload */}
        <div
          style={{
            ...styles.dropZone,
            ...(dragging ? styles.dropZoneActive : {}),
            ...(parsed ? styles.dropZoneLoaded : {}),
          }}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => !parsed && fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".adi,.adif,.ADI,.ADIF" onChange={onFileChange}
            style={{ display: 'none' }} />
          {parsed ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <span style={{ fontWeight: 600 }}>{fileName}</span>
                <span style={{ color: C.gray, marginLeft: 12, fontSize: '0.85rem' }}>
                  {parsed.records.length} records
                </span>
                <span style={{ marginLeft: 12 }}>
                  {errCount > 0 && <Badge severity={SEV.ERROR} count={errCount} />}
                  {' '}{warnCount > 0 && <Badge severity={SEV.WARNING} count={warnCount} />}
                  {' '}{infoCount > 0 && <Badge severity={SEV.INFO} count={infoCount} />}
                  {errCount === 0 && warnCount === 0 && infoCount === 0 && (
                    <span style={{ ...styles.badge, background: C.greenBg, color: C.green }}>VALID</span>
                  )}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                  style={{ ...styles.filterBtn, fontFamily: font }}>Load another</button>
                <button onClick={(e) => { e.stopPropagation(); reset(); }}
                  style={{ ...styles.filterBtn, fontFamily: font, color: C.red, borderColor: C.red }}>Clear</button>
              </div>
            </div>
          ) : (
            <>
              <div style={styles.dropLabel}>
                {dragging ? 'Drop ADIF file here' : 'Drop ADIF file here or click to browse'}
              </div>
              <div style={styles.dropSub}>Supports .adi and .adif files</div>
            </>
          )}
        </div>

        {/* Results */}
        {parsed && validation && summary && (
          <>
            <ProgramChecksPanel programInfo={validation.programInfo} />
            <SummaryPanel summary={summary} />

            {/* Tabs */}
            <div style={styles.tabs}>
              {[
                { key: 'validation', label: `Validation (${validation.issues.length})` },
                { key: 'records', label: `Records (${parsed.records.length})` },
                { key: 'header', label: 'Header' },
                { key: 'extensions', label: 'Extensions' },
              ].map(t => (
                <button key={t.key}
                  onClick={() => setActiveTab(t.key)}
                  style={{ ...styles.tab, ...(activeTab === t.key ? styles.tabActive : {}) }}>
                  {t.label}
                </button>
              ))}
            </div>

            {activeTab === 'validation' && <ValidationPanel issues={validation.issues} />}
            {activeTab === 'records' && <RecordsPanel records={parsed.records} issues={validation.issues} />}
            {activeTab === 'header' && <HeaderView header={parsed.header} />}
            {activeTab === 'extensions' && <ExtensionsPanel extensions={validation.extensions} programInfo={validation.programInfo} />}
          </>
        )}

        {/* Footer */}
        <div style={{ marginTop: '3rem', paddingTop: '1rem', borderTop: `1px solid ${C.grayLight}`, fontSize: '0.78rem', color: C.gray, textAlign: 'center' }}>
          ADIF Validator validates against ADIF specification 3.1.5 / 3.1.6.
          Checks syntax, field formats, enumerations, band/frequency consistency, and program-specific rules for POTA, SOTA, WWFF, LoTW, and more.
        </div>
      </div>
    </div>
  );
}
