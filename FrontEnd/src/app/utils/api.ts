const BASE_URL = "http://localhost:8000";

export function getToken(): string | null {
  return localStorage.getItem("token");
}

export function setToken(token: string) {
  localStorage.setItem("token", token);
}

export function removeToken() {
  localStorage.removeItem("token");
}

async function request(endpoint: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Si no es FormData, establecer Content-Type en application/json
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "Error en la petición";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || errorDetail;
    } catch {
      // Ignorar error de parseo si no es JSON
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // --- Autenticación ---
  async login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const formData = new FormData();
    formData.append("username", email);
    formData.append("password", password);

    const data = await request("/api/auth/login", {
      method: "POST",
      body: formData,
    });
    setToken(data.access_token);
    return data;
  },

  async loginWithGoogle(token: string, role: string): Promise<{ access_token: string; token_type: string }> {
    const data = await request("/api/auth/google", {
      method: "POST",
      body: JSON.stringify({ token, role }),
    });
    setToken(data.access_token);
    return data;
  },

  async register(userData: any): Promise<any> {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  },

  async getMe(): Promise<any> {
    return request("/api/auth/me");
  },

  // --- Citas Médicas ---
  async getAppointments(): Promise<any[]> {
    return request("/api/appointments");
  },

  async createAppointment(appointmentData: any): Promise<any> {
    return request("/api/appointments", {
      method: "POST",
      body: JSON.stringify(appointmentData),
    });
  },

  async updateAppointmentStatus(id: number, status: string): Promise<any> {
    return request(`/api/appointments/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  },

  async getWaitingRoom(): Promise<any[]> {
    return request("/api/appointments/waiting-room");
  },

  // --- Recetas Médicas ---
  async getPrescriptions(): Promise<any[]> {
    return request("/api/prescriptions");
  },

  async createPrescription(prescriptionData: any): Promise<any> {
    return request("/api/prescriptions", {
      method: "POST",
      body: JSON.stringify(prescriptionData),
    });
  },

  async getPrescriptionById(id: string): Promise<any> {
    return request(`/api/prescriptions/${id}`);
  },

  async dispatchPrescription(id: string): Promise<any> {
    return request(`/api/prescriptions/${id}/dispatch`, {
      method: "POST",
    });
  },

  // --- Farmacias ---
  async getNearbyPharmacies(lat: number, lon: number, medicine?: string): Promise<any[]> {
    let url = `/api/pharmacies/nearby?lat=${lat}&lon=${lon}`;
    if (medicine) {
      url += `&medicine=${encodeURIComponent(medicine)}`;
    }
    return request(url);
  },

  async getInventory(pharmacyId: number): Promise<any[]> {
    return request(`/api/pharmacies/${pharmacyId}/inventory`);
  },

  async updateInventoryItem(medicine: string, stock: number): Promise<any> {
    return request("/api/pharmacies/inventory", {
      method: "POST",
      body: JSON.stringify({ medicine, stock }),
    });
  },

  async getSupplierOrders(): Promise<any[]> {
    return request("/api/pharmacies/orders");
  },

  async createSupplierOrder(orderData: any): Promise<any> {
    return request("/api/pharmacies/orders", {
      method: "POST",
      body: JSON.stringify(orderData),
    });
  },

  async updateSupplierOrderStatus(id: string, status: string): Promise<any> {
    return request(`/api/pharmacies/orders/${id}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
  },

  // --- Inteligencia Artificial ---
  async translateGestures(gestures: string[]): Promise<{ original_gestures: string[]; translation: string }> {
    return request("/api/ai/translate", {
      method: "POST",
      body: JSON.stringify({ gestures }),
    });
  },

  async summarizeConsultation(appointmentId: number, transcript: string): Promise<{ summary: string }> {
    return request("/api/ai/summarize", {
      method: "POST",
      body: JSON.stringify({ appointment_id: appointmentId, conversation_transcript: transcript }),
    });
  },

  async queryChatbot(message: string, history?: any[]): Promise<{ reply: string; sources: string[] }> {
    return request("/api/ai/chatbot", {
      method: "POST",
      body: JSON.stringify({ message, chat_history: history }),
    });
  },
};
