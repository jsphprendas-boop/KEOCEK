import { format } from "date-fns";
import { es } from "date-fns/locale";

export const SUPER_ADMIN_EMAILS = [
  "jsphprendas@gmail.com"
];

export const isSuperAdminEmail = (email: string | undefined | null) => {
  if (!email) return false;
  return SUPER_ADMIN_EMAILS.includes(email.toLowerCase());
};

export const maskEmail = (email: string | undefined | null, viewerEmail?: string | null) => {
  if (!email) return "";
  if (isSuperAdminEmail(email)) {
    // Solo si el que está viendo es también Super Admin puede ver el correo real
    if (viewerEmail && isSuperAdminEmail(viewerEmail)) {
      return email;
    }
    return "SUPER ADMIN MAESTRO";
  }
  return email;
};

export const safeFormat = (date: Date | number | string, formatStr: string) => {
  try {
    const d = new Date(date);
    if (isNaN(d.getTime())) return "Fecha Inválida";
    return format(d, formatStr, { locale: es });
  } catch (e) {
    return "F-Error";
  }
};
