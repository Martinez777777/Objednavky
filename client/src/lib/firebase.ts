const FIREBASE_API_KEY = "AIzaSyBmy8-NxboLGJBPRQ5yR9dC-mRmeVThKFI";
const FIREBASE_PROJECT_ID = "objednavky-368a0";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

export async function importProducts(productNames: string[]) {
  const url = `${FIRESTORE_BASE_URL}/Global/Produkty?key=${FIREBASE_API_KEY}`;
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

export async function deleteOrder(branch: string, date: string, orderId: string) {
  const safeBranch = branch.trim();
  const url = `${FIRESTORE_BASE_URL}/${encodeURIComponent(safeBranch)}/Objednavky/${encodeURIComponent(date)}/${orderId}?key=${FIREBASE_API_KEY}`;
  
  const response = await fetch(url, {
    method: 'DELETE',
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
  return true;
}

export async function updateOrder(branch: string, date: string, orderId: string, orderData: any) {
  const safeBranch = branch.trim();
  const url = `${FIRESTORE_BASE_URL}/${encodeURIComponent(safeBranch)}/Objednavky/${encodeURIComponent(date)}/${orderId}?key=${FIREBASE_API_KEY}`;
  
  const payload = {
    fields: {
      orderNumber: { integerValue: String(orderData.orderNumber) },
      customerName: { stringValue: orderData.customerName || "" },
      customerPhone: { stringValue: orderData.customerPhone || "" },
      paymentStatus: { stringValue: orderData.paymentStatus || "Unpaid" },
      deliveryStatus: { stringValue: orderData.deliveryStatus || "Nevydaná" },
      reportType: { stringValue: orderData.reportType || "" },
      date: { stringValue: date || "" },
      note: { stringValue: orderData.note || "" },
      createdAt: { stringValue: orderData.createdAt || new Date().toISOString() },
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

export async function getOrders(branch: string, date: string) {
  try {
    const safeBranch = branch.trim();
    const url = `${FIRESTORE_BASE_URL}/${encodeURIComponent(safeBranch)}/Objednavky/${encodeURIComponent(date)}?key=${FIREBASE_API_KEY}`;
    
    console.log("Načítavam objednávky z:", url);
    const response = await fetch(url);
    const data = await response.json();
    
    if (response.ok && data.documents) {
      return data.documents.map(parseOrderDocument).sort((a: any, b: any) => a.orderNumber - b.orderNumber);
    }

    const altUrl = `${FIRESTORE_BASE_URL}/${encodeURIComponent(safeBranch)}/${encodeURIComponent(date)}/Objednavky?key=${FIREBASE_API_KEY}`;
    console.log("Skúšam záložnú cestu:", altUrl);
    const altResponse = await fetch(altUrl);
    const altData = await altResponse.json();
    
    if (altResponse.ok && altData.documents) {
      return altData.documents.map(parseOrderDocument).sort((a: any, b: any) => a.orderNumber - b.orderNumber);
    }
    
    return [];
  } catch (err) {
    console.error("Chyba pri získavaní objednávok:", err);
    return [];
  }
}

function parseOrderDocument(doc: any) {
  const fields = doc.fields || {};
  const products = (fields.products?.arrayValue?.values || []).map((p: any) => {
    const pf = p.mapValue?.fields || {};
    return {
      name: pf.name?.stringValue || "",
      price: pf.price?.stringValue || "",
      quantity: pf.quantity?.integerValue || "0",
      note: pf.note?.stringValue || ""
    };
  });

  return {
    id: doc.name.split('/').pop(),
    orderNumber: parseInt(fields.orderNumber?.integerValue || "0"),
    customerName: fields.customerName?.stringValue || "",
    customerPhone: fields.customerPhone?.stringValue || "",
    paymentStatus: fields.paymentStatus?.stringValue || "Unpaid",
    deliveryStatus: fields.deliveryStatus?.stringValue || "Nevydaná",
    reportType: fields.reportType?.stringValue || "",
    date: fields.date?.stringValue || "",
    note: fields.note?.stringValue || "",
    createdAt: fields.createdAt?.stringValue || "",
    products
  };
}


export async function getAdminCode() {
  const url = `${FIRESTORE_BASE_URL}/Global/adminCode?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    if (response.status === 404) return "12345";
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
  const data = await response.json();
  return data.fields?.adminCode?.stringValue || "12345";
}

export async function getPrevadzky() {
  const url = `${FIRESTORE_BASE_URL}/Global/Prevadzky?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
  const data = await response.json();
  const fields = data.fields || {};
  
  const sortedKeys = Object.keys(fields).sort((a, b) => {
    const numA = parseInt(a.replace('p', ''));
    const numB = parseInt(b.replace('p', ''));
    return numA - numB;
  });
  
  return sortedKeys.map(key => fields[key].stringValue).filter(Boolean);
}

export async function getDatumy() {
  const url = `${FIRESTORE_BASE_URL}/Global/Datumy?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
  const data = await response.json();
  const fields = data.fields || {};
  
  const dateValues = Object.values(fields).map((f: any) => f.stringValue).filter(Boolean);
  
  return dateValues.sort((a, b) => {
    const partA = a.split(' ')[0].split('.');
    const partB = b.split(' ')[0].split('.');
    
    const dateA = new Date(2000 + parseInt(partA[2]), parseInt(partA[1]) - 1, parseInt(partA[0]));
    const dateB = new Date(2000 + parseInt(partB[2]), parseInt(partB[1]) - 1, parseInt(partB[0]));
    
    return dateA.getTime() - dateB.getTime();
  });
}

export async function getProducts() {
  const url = `${FIRESTORE_BASE_URL}/Global/Produkty?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
  const data = await response.json();
  const fields = data.fields || {};
  
  const products: { name: string; price: string }[] = [];
  
  const sortedKeys = Object.keys(fields).sort((a, b) => {
    const numA = parseInt(a.replace('p', ''));
    const numB = parseInt(b.replace('p', ''));
    return numA - numB;
  });
  
  for (const key of sortedKeys) {
    const productField = fields[key];
    if (productField && productField.stringValue) {
      const fullString = productField.stringValue;
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
    const orders = await getOrders(branch, date);
    const maxNumber = orders.reduce((max: number, order: any) => Math.max(max, order.orderNumber || 0), 0);
    return maxNumber + 1;
  } catch (err) {
    console.error("Chyba pri získavaní čísla objednávky:", err);
    return 1;
  }
}

export async function submitOrder(branch: string, date: string, orderData: any) {
  const docId = `order_${Date.now()}`;
  const safeBranch = branch.trim();
  const payload = {
    fields: {
      orderNumber: { integerValue: String(orderData.orderNumber) },
      customerName: { stringValue: orderData.customerName || "" },
      customerPhone: { stringValue: orderData.customerPhone || "" },
      paymentStatus: { stringValue: orderData.paymentStatus || "Unpaid" },
      deliveryStatus: { stringValue: orderData.deliveryStatus || "Nevydaná" },
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

  const url = `${FIRESTORE_BASE_URL}/${encodeURIComponent(safeBranch)}/Objednavky/${encodeURIComponent(date)}/${docId}?key=${FIREBASE_API_KEY}`;
  
  try {
    const response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    
    if (!response.ok) {
      throw new Error(`Firebase Error: ${response.statusText}`);
    }
    return response.json();
  } catch (err) {
    console.error("Chyba pri odosielaní objednávky:", err);
    throw err;
  }
}

export async function getInfoText(): Promise<string> {
  const url = `${FIRESTORE_BASE_URL}/Global/Informacie?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) return "";
  const data = await response.json();
  return data.fields?.text?.stringValue || "";
}

export async function saveInfoText(text: string): Promise<void> {
  const url = `${FIRESTORE_BASE_URL}/Global/Informacie?key=${FIREBASE_API_KEY}`;
  const response = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: { text: { stringValue: text } } }),
  });
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Firebase Error: ${errorData.error?.message || response.statusText}`);
  }
}
