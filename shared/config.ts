export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBmy8-NxboLGJBPRQ5yR9dC-mRmeVThKFI",
  authDomain: "objednavky-368a0.firebaseapp.com",
  projectId: "objednavky-368a0",
  storageBucket: "objednavky-368a0.firebasestorage.app",
  messagingSenderId: "302716969878",
  appId: "1:302716969878:android:a0af901c553754859eb3b7"
};

export const MENU_ITEMS = [
  {
    label: "Nová objednávka",
    icon: "PlusCircle",
    id: "new_order"
  },
  {
    label: "Prehľad objednávok",
    icon: "ClipboardList",
    id: "order_overview"
  },
  {
    label: "Vydané objednávky",
    icon: "CheckCircle2",
    id: "delivered_orders"
  },
  {
    label: "Nevydané objednávky",
    icon: "Clock",
    id: "pending_orders"
  },
  {
    label: "Objednávky na ODBYT",
    icon: "ShoppingCart",
    id: "sales_orders"
  },
  {
    label: "Výber prevádzky",
    icon: "Store",
    id: "select_branch"
  },
  {
    label: "Import položiek",
    icon: "FileDown",
    id: "import_items"
  }
];

export const ADMIN_CONFIG = {
  code: "123",
  firestoreBaseUrl: "https://firestore.googleapis.com/v1/projects/objednavky-368a0/databases/(default)/documents"
};
