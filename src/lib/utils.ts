import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(amount);
};

export const formatPhoneNumber = (phone: string): string => {
  // Format Indonesian phone numbers
  const cleaned = phone.replace(/\D/g, '');
  
  if (cleaned.startsWith('62')) {
    return `+${cleaned}`;
  } else if (cleaned.startsWith('0')) {
    return `+62${cleaned.slice(1)}`;
  }
  
  return `+62${cleaned}`;
};

export const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const formatRelativeTime = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - dateObj.getTime();
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 1) return 'Baru saja';
  if (minutes < 60) return `${minutes} menit yang lalu`;
  if (hours < 24) return `${hours} jam yang lalu`;
  if (days < 7) return `${days} hari yang lalu`;
  
  return formatDate(dateObj);
};

export const getStatusColor = (status: string): string => {
  const colors = {
    cold: 'bg-gray-100 text-gray-800',
    warm: 'bg-yellow-100 text-yellow-800',
    hot: 'bg-orange-100 text-orange-800',
    paid: 'bg-green-100 text-green-800',
    service: 'bg-blue-100 text-blue-800',
    repayment: 'bg-purple-100 text-purple-800',
    advocate: 'bg-pink-100 text-pink-800',
  };
  
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
};