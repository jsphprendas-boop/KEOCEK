/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function apiFetch(url: string, options: RequestInit = {}) {
  let userEmail = "";
  try {
    const userStr = localStorage.getItem("ia_user");
    if (userStr) {
      const user = JSON.parse(userStr);
      userEmail = user.email;
    }
  } catch (e) {}
  
  const headers = {
    ...options.headers as any,
    "Content-Type": "application/json",
    "x-user-email": userEmail
  };

  try {
    const response = await fetch(url, { ...options, headers });
    
    const contentType = response.headers.get("content-type");
    const isJson = contentType && contentType.includes("application/json");

    if (!response.ok) {
      let errorMsg = `HTTP error! status: ${response.status}`;
      if (isJson) {
        const errorData = await response.json().catch(() => ({}));
        errorMsg = errorData.error || errorMsg;
      }
      throw new Error(errorMsg);
    }

    if (isJson) {
      return response.json();
    }
    
    return {};
  } catch (e: any) {
    if (e.message === 'Failed to fetch') {
      throw new Error(`Error de conexión (vía fetch) a ${url}. Verifique que el servidor esté activo.`);
    }
    throw e;
  }
}
