/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export async function apiFetch(url: string, options: RequestInit = {}) {
  const delegationId = localStorage.getItem("ia_delegation_id") || "default";
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
    "x-delegation-id": delegationId,
    "x-user-email": userEmail
  };

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
  
  // If not JSON but OK, just return empty object or text
  return {};
}
