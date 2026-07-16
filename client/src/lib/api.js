import { API_URL } from "./constants";

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export function createRide({ driverName, carLabel }) {
  return request("/rides", {
    method: "POST",
    body: JSON.stringify({ driverName, carLabel }),
  });
}

export function fetchRide(code) {
  return request(`/rides/${code}`);
}

export function fetchSummary(code) {
  return request(`/rides/${code}/summary`);
}
