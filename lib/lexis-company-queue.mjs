const CLOSED = new Set(['encerrado', 'atendido']);
const STATUS_ORDER = Object.freeze({
  vencido: 0,
  atencao: 1,
  em_dia: 2,
  sem_data: 3,
  atendido: 4,
  encerrado: 5,
});

function normalized(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .trim();
}

function isOpen(item) {
  return !CLOSED.has(String(item?.status ?? '').toLowerCase());
}

function datePlusDays(day, days) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(day ?? ''))) return null;
  const date = new Date(`${day}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function matchesView(item, view, today) {
  const status = String(item?.status ?? '').toLowerCase();
  switch (view) {
    case 'prioridades':
    case 'abertas':
      return isOpen(item);
    case 'vencidos':
    case 'vencido':
    case 'overdue':
      return status === 'vencido';
    case 'hoje':
      return isOpen(item) && item?.due_on === today;
    case 'proximos': {
      const end = datePlusDays(today, 7);
      return isOpen(item) && !!item?.due_on && item.due_on >= today && !!end && item.due_on <= end;
    }
    case 'em_dia':
      return isOpen(item) && (status === 'em_dia' || status === 'atencao');
    case 'sem_data':
      return isOpen(item) && status === 'sem_data';
    case 'finalizados':
      return CLOSED.has(status);
    case 'atendidos':
      return status === 'atendido';
    case 'todos':
    default:
      return true;
  }
}

function compareQueueItems(a, b) {
  const aStatus = STATUS_ORDER[String(a?.status ?? '').toLowerCase()] ?? 6;
  const bStatus = STATUS_ORDER[String(b?.status ?? '').toLowerCase()] ?? 6;
  if (aStatus !== bStatus) return aStatus - bStatus;
  const aDate = String(a?.due_on || '9999-12-31');
  const bDate = String(b?.due_on || '9999-12-31');
  if (aDate !== bDate) return aDate.localeCompare(bDate);
  return String(a?.title || '').localeCompare(String(b?.title || ''), 'pt-BR') ||
    String(a?.id || '').localeCompare(String(b?.id || ''));
}

export function filterLexisCompanyQueue(items = [], { view = 'prioridades', today = '', query = '' } = {}) {
  const term = normalized(query);
  return (items || [])
    .filter(item => item && item.kind !== 'audiencia')
    .filter(item => matchesView(item, view, today))
    .filter(item => {
      if (!term) return true;
      const fields = [item.title, item.client_name, item.process_number, item.responsible, item.notes, item.source];
      return fields.some(value => normalized(value).includes(term));
    })
    .sort(compareQueueItems);
}

export function summarizeLexisCompanyQueue(items = [], today = '') {
  const rows = (items || []).filter(item => item && item.kind !== 'audiencia');
  const summary = {
    total: rows.length,
    abertas: 0,
    vencidos: 0,
    hoje: 0,
    em_dia: 0,
    sem_data: 0,
    finalizados: 0,
    atendidos: 0,
  };
  for (const item of rows) {
    const status = String(item?.status ?? '').toLowerCase();
    if (isOpen(item)) summary.abertas++;
    if (status === 'vencido') summary.vencidos++;
    if (isOpen(item) && item?.due_on === today) summary.hoje++;
    if (isOpen(item) && (status === 'em_dia' || status === 'atencao')) summary.em_dia++;
    if (isOpen(item) && status === 'sem_data') summary.sem_data++;
    if (status === 'encerrado') summary.finalizados++;
    if (status === 'atendido') summary.atendidos++;
  }
  return summary;
}
