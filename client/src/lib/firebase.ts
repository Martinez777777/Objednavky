import { FIREBASE_CONFIG, ADMIN_CONFIG } from "@shared/config";

export async function importProducts(productNames: string[]) {
  const url = `${ADMIN_CONFIG.firestoreBaseUrl}/Global/Produkty?key=${FIREBASE_CONFIG.apiKey}`;
  const fields: any = {};
  productNames.forEach((name, index) => {
    fields[`p${index}`] = { stringValue: name };
  });
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
  return response.json();
}

export async function getPrevadzky() {
  const url = `${ADMIN_CONFIG.firestoreBaseUrl}/Global/Prevadzky?key=${FIREBASE_CONFIG.apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
  const data = await response.json();
  const fields = data.fields || {};
  
  // Sort fields by key to maintain consistent order (p0, p1, p2...)
  const sortedKeys = Object.keys(fields).sort((a, b) => {
    const numA = parseInt(a.replace('p', ''));
    const numB = parseInt(b.replace('p', ''));
    return numA - numB;
  });
  
  return sortedKeys.map(key => fields[key].stringValue).filter(Boolean);
}

export async function getAdminCode() {
  const url = `${ADMIN_CONFIG.firestoreBaseUrl}/Global/adminCode?key=${FIREBASE_CONFIG.apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
  const data = await response.json();
  return data.fields?.adminCode?.stringValue;
}

export async function getDatumy() {
  const url = `${ADMIN_CONFIG.firestoreBaseUrl}/Global/Datumy?key=${FIREBASE_CONFIG.apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
  const data = await response.json();
  const fields = data.fields || {};
  
  // Načítame všetky hodnoty a zoradíme ich
  const dateValues = Object.values(fields).map((f: any) => f.stringValue).filter(Boolean);
  
  return dateValues.sort((a, b) => {
    // Predpokladáme formát DD.MM.YY ...
    const partA = a.split(' ')[0].split('.');
    const partB = b.split(' ')[0].split('.');
    
    const dateA = new Date(2000 + parseInt(partA[2]), parseInt(partA[1]) - 1, parseInt(partA[0]));
    const dateB = new Date(2000 + parseInt(partB[2]), parseInt(partB[1]) - 1, parseInt(partB[0]));
    
    return dateA.getTime() - dateB.getTime();
  });
}

export async function getProducts() {
  const url = `${ADMIN_CONFIG.firestoreBaseUrl}/Global/Produkty?key=${FIREBASE_CONFIG.apiKey}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
  const data = await response.json();
  const fields = data.fields || {};
  
  const products: { name: string; price: string }[] = [];
  
  // Sort keys (p0, p1, p2...) numerically
  const sortedKeys = Object.keys(fields).sort((a, b) => {
    const numA = parseInt(a.replace('p', ''));
    const numB = parseInt(b.replace('p', ''));
    return numA - numB;
  });
  
  for (const key of sortedKeys) {
    const productField = fields[key];
    if (productField && productField.stringValue) {
      const fullString = productField.stringValue;
      // User wants format "Name - Price€" directly from the string
      // If the string contains " - ", we can split it for internal logic,
      // but the requirement is to display it as is.
      const parts = fullString.split(" - ");
      if (parts.length >= 2) {
        products.push({ 
          name: parts[0].trim(), 
          price: parts[1].trim() 
        });
      } else {
        products.push({ 
          name: fullString, 
          price: "" 
        });
      }
    }
  }
  return products;
}

export async function getNextOrderNumber(branch: string, date: string) {
  try {
    const safeDate = date.replace(/\./g, '_');
    // Štruktúra: [Branch] (Kolekcia) -> Objednavky (Dokument) -> [Date] (Kolekcia)
    // Pre získanie zoznamu dokumentov v kolekcii [Date] použijeme URL bez ID dokumentu na konci
    const url = `${ADMIN_CONFIG.firestoreBaseUrl}/${encodeURIComponent(branch.trim())}/Objednavky/${encodeURIComponent(safeDate)}?key=${FIREBASE_CONFIG.apiKey}`;
    
    const response = await fetch(url);
    if (!response.ok) {
      // Ak kolekcia/dokument neexistuje, začíname od 1
      if (response.status === 404) return 1;
      return 1;
    }
    
    const data = await response.json();
    // Firestore REST API vráti objekt s polom 'documents' pri listovaní kolekcie
    const documents = data.documents || [];
    return documents.length + 1;
  } catch (err) {
    console.error("Chyba pri získavaní čísla objednávky:", err);
    return 1;
  }
}

export async function submitOrder(branch: string, date: string, orderData: any) {
  const docId = `order_${Date.now()}`;
  const safeBranch = branch.trim();
  const safeDate = date.replace(/\./g, '_');
  
  // Cesta: [Branch] (Kolekcia) -> Objednavky (Dokument) -> [Date] (Kolekcia) -> [OrderId] (Dokument)
  const url = `${ADMIN_CONFIG.firestoreBaseUrl}/${encodeURIComponent(safeBranch)}/Objednavky/${encodeURIComponent(safeDate)}/${docId}?key=${FIREBASE_CONFIG.apiKey}`;
  
  const payload = {
    fields: {
      orderNumber: { integerValue: String(orderData.orderNumber) },
      customerName: { stringValue: orderData.customerName || "" },
      customerPhone: { stringValue: orderData.customerPhone || "" },
      paymentStatus: { stringValue: orderData.paymentStatus || "Unpaid" },
      reportType: { stringValue: orderData.reportType || "" },
      date: { stringValue: date || "" },
      note: { stringValue: orderData.note || "" },
      createdAt: { stringValue: new Date().toISOString() },
      products: {
        arrayValue: {
          values: (orderData.products || []).map((p: any) => ({
            mapValue: {
              fields: {
                name: { stringValue: p.name || "" },
                price: { stringValue: p.price || "" },
                quantity: { integerValue: String(p.quantity || "0") },
                note: { stringValue: p.note || "" }
              }
            }
          }))
        }
      }
    }
  };
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
  return response.json();
}
