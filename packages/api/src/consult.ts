// ============================================================================
// Paid Consultation Types
// ============================================================================

export type ConsultCategory = "vps" | "ai" | "web" | "other";

export type ConsultPackage = "text" | "remote" | "full" | "unsure";

export type ConsultContactType = "wechat" | "qq" | "telegram" | "email";

export type ConsultStatus = "pending" | "accepted" | "rejected" | "processing" | "completed" | "cancelled";

export type ConsultPaymentStatus = "unpaid" | "paid" | "refunded";

export type ConsultNotifyStatus = "pending" | "sent" | "failed" | "skipped";

export interface CreateConsultRequest {
  category: ConsultCategory;
  package: ConsultPackage;
  problem: string;
  expected: string;
  contactType: ConsultContactType;
  contactAccount: string;
  // 蜜罐字段：正常用户不会填写，用于拦截垃圾提交
  website?: string;
}

export interface CreateConsultResponse {
  id: number;
  requestNo: string;
}

export interface ConsultListItem {
  id: number;
  requestNo: string;
  category: ConsultCategory;
  package: ConsultPackage;
  packagePrice: number;
  contactType: ConsultContactType;
  contactAccount: string;
  status: ConsultStatus;
  paymentStatus: ConsultPaymentStatus;
  isRead: boolean;
  notifyStatus: ConsultNotifyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultDetail extends ConsultListItem {
  problem: string;
  expected: string;
  adminNote: string;
  readAt: string | null;
  notifiedAt: string | null;
  notifyError: string;
  notifyAttempts: number;
}

export interface ConsultListResponse {
  total: number;
  page: number;
  limit: number;
  data: ConsultListItem[];
}

export interface ConsultUnreadResponse {
  unread: number;
  items: ConsultListItem[];
}

export interface UpdateConsultRequest {
  status?: ConsultStatus;
  paymentStatus?: ConsultPaymentStatus;
  adminNote?: string;
}

export interface ConsultActionResponse {
  success: boolean;
  notifyStatus?: ConsultNotifyStatus;
  notifyError?: string;
}
