export const LEAD_STATUS_LABELS = {
  cold: 'Cold',
  warm: 'Warm', 
  hot: 'Hot',
  paid: 'Paid',
  service: 'Service',
  repayment: 'Repayment',
  advocate: 'Advocate',
};

export const STAGE_1_STATUSES = ['cold', 'warm', 'hot', 'paid'] as const;
export const STAGE_2_STATUSES = ['service', 'repayment', 'advocate'] as const;

export const USER_ROLES = {
  admin: 'Admin',
  supervisor: 'Supervisor', 
  agent: 'Agent',
};

export const MESSAGE_TYPES = {
  text: 'Text',
  image: 'Image',
  video: 'Video',
  audio: 'Audio',
  document: 'Document',
  contact: 'Contact',
  location: 'Location',
};

export const JENIS_UTANG_OPTIONS = [
  'KTA (Kredit Tanpa Agunan)',
  'KPR (Kredit Pemilikan Rumah)', 
  'Kredit Kendaraan',
  'Kartu Kredit',
  'Pinjaman Online',
  'Lainnya',
];