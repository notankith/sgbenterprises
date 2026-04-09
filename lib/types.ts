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
  assignedTripId?: string;
};

export type Payment = {
  invoiceNumber: string;
  amount: number;
  mode: string;
  collectedBy: string;
  date: string;
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
  type: 'payment' | 'expense';
  status: 'pending' | 'approved';
  createdAt: string;
  approvedAt?: string;
  payload: Record<string, any>;
};

export type TripSheet = {
  _id?: string;
  agentName: string;
  invoiceNumbers: string[];
  createdAt: string;
  updatedAt: string;
};
