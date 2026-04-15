export type PaymentStatus = 'paid' | 'partial' | 'unpaid';
export type DeliveryStatus = 'delivered' | 'pending';

export type Invoice = {
  _id?: string;
  invoiceNumber: string;
  date: string;
  shopName: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: PaymentStatus;
  deliveryStatus: DeliveryStatus;
  deliveryPerson?: string;
  archived: boolean;
  notes: { text: string; timestamp: string }[];
  deductions?: { type: string; typeLabel?: string; amount: number; createdAt?: string }[];
  deductedAmount?: number;
  assignedTripId?: string;
};

export type Payment = {
  _id?: string;
  invoiceId?: string;
  invoiceNumber: string;
  amount: number;
  mode: string;
  collectedBy: string;
  role?: 'driver' | 'admin';
  reference?: string | null;
  status?: 'pending' | 'approved' | 'rejected';
  date: string;
  chequeNumber?: string | null;
  bankName?: string | null;
  chequeStatus?: 'pending' | 'deposited' | 'cleared' | 'bounced' | null;
  proofImageUrl?: string | null;
  proofImageKey?: string | null;
};

export type Expense = {
  _id?: string;
  date: string;
  amount: number;
  category: string;
  addedBy: string;
  notes?: string;
  approvedAt?: string;
};

export type Approval = {
  _id?: string;
  type: 'payment' | 'expense' | 'deduction';
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string | null;
  payload: Record<string, any>;
};

export type TripSheet = {
  _id?: string;
  agentName: string;
  invoiceNumbers: string[];
  createdAt: string;
  updatedAt: string;
};
