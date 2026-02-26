import { MinimalButton } from "@/components/MinimalButton";
import { motion, AnimatePresence } from "framer-motion";
const MENU_ITEMS = [
  { label: "Nová objednávka", icon: "PlusCircle", id: "new_order" },
  { label: "Prehľad objednávok", icon: "ClipboardList", id: "order_overview" },
  { label: "Objednávky na ODBYT", icon: "ShoppingCart", id: "sales_orders" },
  { label: "Informácie", icon: "Info", id: "info" },
  { label: "Výber prevádzky", icon: "Store", id: "select_branch" },
  { label: "Import položiek", icon: "FileDown", id: "import_items" }
];
import { getAdminCode, getPrevadzky, importProducts, getDatumy, getProducts, getNextOrderNumber, submitOrder, getOrders, deleteOrder, updateOrder, getInfoText, saveInfoText } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LogOut, Check, Calendar, Plus, User, Phone, Package, Trash2, Edit2, Search, Info, Pencil, Save, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Product {
  name: string;
  price: string;
}

interface OrderProduct {
  name: string;
  price: string;
  quantity: string;
  note: string;
}

export default function Home() {
  const { toast } = useToast();
  const [isPending, setIsPending] = useState(false);
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [isBranchDialogOpen, setIsBranchDialogOpen] = useState(false);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [isNewOrderDialogOpen, setIsNewOrderDialogOpen] = useState(false);
  const [isOdbytDialogOpen, setIsOdbytDialogOpen] = useState(false);
  
  const [adminInput, setAdminInput] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [isInitialLoad, setIsInitialLoad] = useState<boolean>(true);
  const [prevadzky, setPrevadzky] = useState<string[]>([]);
  const [datumy, setDatumy] = useState<string[]>([]);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [activeBranch, setActiveBranch] = useState<string | null>(null);
  
  const [orderNumber, setOrderNumber] = useState<number>(1);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"Paid" | "Unpaid" | null>(null);
  const [reportType, setReportType] = useState<"Order" | "FreeSale" | null>(null);
  const [orderProducts, setOrderProducts] = useState<OrderProduct[]>([]);
  const [orderNote, setOrderNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isOrdersOverviewOpen, setIsOrdersOverviewOpen] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isStatusConfirmOpen, setIsStatusConfirmOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<any>(null);
  const [orderToUpdateStatus, setOrderToUpdateStatus] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [overviewFilter, setOverviewFilter] = useState<"All" | "Delivered" | "Undelivered">("All");
  const [isOrderPreviewOpen, setIsOrderPreviewOpen] = useState(false);
  const [isInfoDialogOpen, setIsInfoDialogOpen] = useState(false);
  const [infoText, setInfoText] = useState("");
  const [infoEditStep, setInfoEditStep] = useState<"view" | "admin" | "edit">("view");
  const [infoAdminInput, setInfoAdminInput] = useState("");
  const [infoEditText, setInfoEditText] = useState("");
  const [isInfoSaving, setIsInfoSaving] = useState(false);
  const [selectedOrderDetail, setSelectedOrderDetail] = useState<any>(null);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      (order.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.orderNumber || "").toString().includes(searchQuery);
    
    if (overviewFilter === "Delivered") return matchesSearch && order.deliveryStatus === "Vydaná";
    if (overviewFilter === "Undelivered") return matchesSearch && order.deliveryStatus === "Nevydaná";
    return matchesSearch;
  });

  const handleToggleDeliveryStatus = (order: any) => {
    setOrderToUpdateStatus(order);
    setIsStatusConfirmOpen(true);
  };

  const confirmToggleDeliveryStatus = async () => {
    if (!orderToUpdateStatus) return;
    setIsPending(true);
    try {
      const newStatus = orderToUpdateStatus.deliveryStatus === "Vydaná" ? "Nevydaná" : "Vydaná";
      await updateOrder(activeBranch!, selectedDate!, orderToUpdateStatus.id, {
        ...orderToUpdateStatus,
        deliveryStatus: newStatus
      });
      const fetchedOrders = await getOrders(activeBranch!, selectedDate!);
      setOrders(fetchedOrders);
      toast({ title: "Status zmenený", description: `Objednávka bola označená ako ${newStatus}.` });
    } catch (error: any) {
      toast({ title: "Chyba", description: "Nepodarilo sa zmeniť status doručenia.", variant: "destructive" });
    } finally {
      setIsPending(false);
      setIsStatusConfirmOpen(false);
      setOrderToUpdateStatus(null);
    }
  };

  const getOdbytData = () => {
    const orderTotals: Record<string, number> = {};
    const freeSaleTotals: Record<string, number> = {};
    const orderProductNotes: Record<string, string[]> = {};
    const freeSaleProductNotes: Record<string, string[]> = {};
    const orderNotes: string[] = [];
    const freeSaleNotes: string[] = [];

    orders.forEach(order => {
      const isOrder = order.reportType === "Order";
      const target = isOrder ? orderTotals : freeSaleTotals;
      const notesTarget = isOrder ? orderProductNotes : freeSaleProductNotes;
      order.products.forEach((p: any) => {
        const qty = parseInt(p.quantity) || 0;
        if (qty > 0) {
          target[p.name] = (target[p.name] || 0) + qty;
          if (p.note && p.note.trim()) {
            if (!notesTarget[p.name]) notesTarget[p.name] = [];
            notesTarget[p.name].push(`#${order.orderNumber} ${order.customerName}: ${p.note.trim()}`);
          }
        }
      });
      if (order.note && order.note.trim()) {
        const label = `#${order.orderNumber} ${order.customerName}: ${order.note.trim()}`;
        if (isOrder) {
          orderNotes.push(label);
        } else {
          freeSaleNotes.push(label);
        }
      }
    });

    return { orderTotals, freeSaleTotals, orderProductNotes, freeSaleProductNotes, orderNotes, freeSaleNotes };
  };

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);
  
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);

  useEffect(() => {
    const authStatus = localStorage.getItem("device_authorized");
    const storedBranch = localStorage.getItem("active_branch");
    if (storedBranch) setActiveBranch(storedBranch);

    if (authStatus === "true") {
      setIsAuthorized(true);
      setIsInitialLoad(false);
    } else {
      setIsAdminDialogOpen(true);
      setIsInitialLoad(false);
    }
  }, []);

  const handleLogout = () => {
    setPendingAction("LOGOUT");
    setIsAdminDialogOpen(true);
  };
  
  const handleButtonClick = async (label: string) => {
    if (label === "Nová objednávka") {
      setPendingAction(label);
      handleDateSelection();
      return;
    }

    const dateRequiredActions = [
      "Prehľad objednávok", 
      "Objednávky na ODBYT"
    ];

    if (label === "Výber prevádzky" || label === "Import položiek") {
      setPendingAction(label);
      setIsAdminDialogOpen(true);
      return;
    }

    if (dateRequiredActions.includes(label)) {
      setPendingAction(label);
      handleDateSelection();
      return;
    }

    executeAction(label);
  };

  const handleDateSelection = async () => {
    setIsPending(true);
    try {
      const list = await getDatumy();
      setDatumy(list);
      setIsDateDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: "Nepodarilo sa načítať dátumy.",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  const saveDate = async (date: string) => {
    setSelectedDate(date);
    setIsDateDialogOpen(false);
    
    if (pendingAction === "Nová objednávka") {
      setIsPending(true);
      try {
        const products = await getProducts();
        const nextNum = await getNextOrderNumber(activeBranch!, date);
        setAvailableProducts(products);
        setOrderNumber(nextNum);
        
        // Auto-initialize all available products with quantity 0
        const initialOrderProducts: OrderProduct[] = products.map(p => ({
          name: p.name,
          price: p.price,
          quantity: "",
          note: ""
        }));
        
        setOrderProducts(initialOrderProducts);
        setCustomerName("");
        setCustomerPhone("");
        setOrderNote("");
        setValidationError(null);
        setIsNewOrderDialogOpen(true);
      } catch (error: any) {
        console.error("Chyba pri príprave objednávky:", error);
        toast({
          title: "Chyba",
          description: `Nepodarilo sa pripraviť novú objednávku: ${error.message || 'Neznáma chyba'}`,
          variant: "destructive",
        });
      } finally {
        setIsPending(false);
      }
      setPendingAction(null);
      return;
    }

    if (pendingAction === "Prehľad objednávok") {
      setIsPending(true);
      try {
        const fetchedOrders = await getOrders(activeBranch!, date);
        setOrders(fetchedOrders);
        setOverviewFilter("All");
        setIsOrdersOverviewOpen(true);
      } catch (error: any) {
        toast({
          title: "Chyba",
          description: "Nepodarilo sa načítať objednávky.",
          variant: "destructive",
        });
      } finally {
        setIsPending(false);
      }
      setPendingAction(null);
      return;
    }

    if (pendingAction === "Objednávky na ODBYT") {
      setIsPending(true);
      try {
        const fetchedOrders = await getOrders(activeBranch!, date);
        setOrders(fetchedOrders);
        setIsOdbytDialogOpen(true);
      } catch (error: any) {
        toast({
          title: "Chyba",
          description: "Nepodarilo sa načítať objednávky na odbyt.",
          variant: "destructive",
        });
      } finally {
        setIsPending(false);
      }
      setPendingAction(null);
      return;
    }

    if (pendingAction) {
      executeAction(pendingAction, date);
      setPendingAction(null);
    }
  };

  const addProductToOrder = (product: Product) => {
    setOrderProducts([...orderProducts, { 
      name: product.name, 
      price: product.price, 
      quantity: "", 
      note: "" 
    }]);
  };

  const updateProductQuantity = (index: number, quantity: string) => {
    const newProducts = [...orderProducts];
    newProducts[index].quantity = quantity;
    setOrderProducts(newProducts);
  };

  const updateProductNote = (index: number, note: string) => {
    const newProducts = [...orderProducts];
    newProducts[index].note = note;
    setOrderProducts(newProducts);
  };

  const removeProductFromOrder = (index: number) => {
    setOrderProducts(orderProducts.filter((_, i) => i !== index));
  };

  const handleSubmitOrder = () => {
    if (!activeBranch) {
      setValidationError("Chyba. Nemáš zvolenú prevádzku.");
      return;
    }
    if (!customerName || !customerPhone || !paymentStatus || !reportType) {
      setValidationError("Chyba. Musíte vyplniť meno, telefón, stav platby aj hlásenie.");
      return;
    }
    if (orderProducts.length === 0) {
      toast({ title: "Chyba", description: "Pridajte aspoň jeden produkt.", variant: "destructive" });
      return;
    }
    setValidationError(null);
    setIsOrderPreviewOpen(true);
  };

  const confirmSaveOrder = async () => {
    setIsPending(true);
    try {
      if (isEditing && editingOrderId) {
        await updateOrder(activeBranch!, selectedDate!, editingOrderId, {
          orderNumber,
          customerName,
          customerPhone,
          paymentStatus,
          reportType,
          products: orderProducts,
          note: orderNote
        });
        setSuccessMessage("Objednávka bola upravená");
        if (isOrdersOverviewOpen) {
          const fetchedOrders = await getOrders(activeBranch!, selectedDate!);
          setOrders(fetchedOrders);
        }
      } else {
        await submitOrder(activeBranch!, selectedDate!, {
          orderNumber,
          customerName,
          customerPhone,
          paymentStatus,
          reportType,
          products: orderProducts,
          note: orderNote
        });
        setSuccessMessage("Objednávka je uložená");
      }
      setIsOrderPreviewOpen(false);
      setIsNewOrderDialogOpen(false);
      setIsEditing(false);
      setEditingOrderId(null);
      setPaymentStatus(null);
      setReportType(null);
      setCustomerName("");
      setCustomerPhone("");
      setOrderNote("");
    } catch (error: any) {
      toast({ title: "Chyba", description: `Nepodarilo sa ${isEditing ? 'upraviť' : 'uložiť'} objednávku.`, variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleEditOrder = async (order: any) => {
    setIsPending(true);
    try {
      const products = await getProducts();
      setAvailableProducts(products);
      
      setOrderNumber(order.orderNumber);
      setCustomerName(order.customerName);
      setCustomerPhone(order.customerPhone);
      setPaymentStatus(order.paymentStatus);
      setReportType(order.reportType);
      setOrderNote(order.note);
      setOrderProducts(order.products);
      
      setEditingOrderId(order.id);
      setIsEditing(true);
      setValidationError(null);
      setIsNewOrderDialogOpen(true);
    } catch (error: any) {
      toast({ title: "Chyba", description: "Nepodarilo sa načítať dáta pre úpravu.", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete) return;
    setPendingAction("DELETE_ORDER");
    setIsAdminDialogOpen(true);
  };

  const confirmDeleteOrder = async () => {
    setIsPending(true);
    try {
      await deleteOrder(activeBranch!, selectedDate!, orderToDelete.id);
      const fetchedOrders = await getOrders(activeBranch!, selectedDate!);
      setOrders(fetchedOrders);
      toast({ title: "Zmazané", description: "Objednávka bola úspešne zmazaná." });
    } catch (error: any) {
      toast({ title: "Chyba", description: "Nepodarilo sa zmazať objednávku.", variant: "destructive" });
    } finally {
      setIsPending(false);
      setIsDeleteDialogOpen(false);
      setOrderToDelete(null);
      setPendingAction(null);
    }
  };

  const handleImportFile = async () => {
    if (!importFile) return;
    setIsPending(true);
    try {
      const text = await importFile.text();
      const products = text.split("\n").map(p => p.trim()).filter(p => p.length > 0);
      
      await importProducts(products);
      
      setIsImportDialogOpen(false);
      setImportFile(null);
      toast({
        title: "Import úspešný",
        description: `Bolo importovaných ${products.length} položiek.`,
      });
      executeAction("Import položiek");
    } catch (error: any) {
      toast({
        title: "Chyba importu",
        description: error.message || "Nepodarilo sa nahrať produkty.",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleBranchSelection = async () => {
    setIsPending(true);
    try {
      const list = await getPrevadzky();
      setPrevadzky(list);
      setIsBranchDialogOpen(true);
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: "Nepodarilo sa načítať prevádzky.",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  const saveBranch = () => {
    if (!selectedBranch) return;
    localStorage.setItem("active_branch", selectedBranch);
    setActiveBranch(selectedBranch);
    setIsBranchDialogOpen(false);
    toast({
      title: "Uložené",
      description: `Aktuálna prevádzka: ${selectedBranch}`,
    });
    executeAction("Výber prevádzky");
  };

  const executeAction = async (label: string, date?: string) => {
    if (label === "LOGOUT") {
      localStorage.removeItem("device_authorized");
      localStorage.removeItem("active_branch");
      setIsAuthorized(false);
      setActiveBranch(null);
      setIsAdminDialogOpen(true);
      toast({
        title: "Zariadenie odhlásené",
        description: "Pre prístup k aplikácii musíte znova zadať admin kód.",
      });
      return;
    }

    if (label === "Výber prevádzky" && !isBranchDialogOpen) {
      handleBranchSelection();
      return;
    }

    if (label === "Import položiek" && !isImportDialogOpen) {
      setIsImportDialogOpen(true);
      return;
    }

    if (label === "Informácie") {
      setIsPending(true);
      try {
        const text = await getInfoText();
        setInfoText(text);
        setInfoEditStep("view");
        setInfoAdminInput("");
        setInfoEditText(text);
        setIsInfoDialogOpen(true);
      } catch (error: any) {
        toast({
          title: "Chyba",
          description: "Nepodarilo sa načítať informácie.",
          variant: "destructive",
        });
      } finally {
        setIsPending(false);
      }
      return;
    }

    setIsPending(true);
    toast({
      title: "Úspech",
      description: `Akcia "${label}"${date ? ` pre dátum ${date}` : ""} bola zaznamenaná.`,
    });
    setIsPending(false);
  };

  const verifyInfoAdminCode = async () => {
    setIsPending(true);
    try {
      const correctCode = await getAdminCode();
      if (String(infoAdminInput).trim() === String(correctCode).trim()) {
        setInfoEditStep("edit");
        setInfoAdminInput("");
      } else {
        toast({
          title: "Nesprávny kód",
          description: "Zadaný admin kód nie je správny.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: "Nepodarilo sa overiť admin kód.",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  const handleSaveInfoText = async () => {
    setIsInfoSaving(true);
    try {
      await saveInfoText(infoEditText);
      setInfoText(infoEditText);
      setInfoEditStep("view");
      toast({
        title: "Uložené",
        description: "Text bol úspešne uložený.",
      });
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: "Nepodarilo sa uložiť text.",
        variant: "destructive",
      });
    } finally {
      setIsInfoSaving(false);
    }
  };

  const verifyAdminCode = async () => {
    setIsPending(true);
    try {
      const correctCode = await getAdminCode();
      if (String(adminInput).trim() === String(correctCode).trim()) {
        localStorage.setItem("device_authorized", "true");
        setIsAuthorized(true);
        setIsAdminDialogOpen(false);
        setAdminInput("");
        
        if (pendingAction === "DELETE_ORDER") {
          confirmDeleteOrder();
          return;
        }

        if (pendingAction) {
          executeAction(pendingAction);
          setPendingAction(null);
        }
      } else {
        toast({
          title: "Nesprávny kód",
          description: "Zadaný admin kód nie je správny.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      toast({
        title: "Chyba",
        description: "Nepodarilo sa overiť kód.",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  };

  if (isInitialLoad) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 bg-slate-50">
      <AnimatePresence>
        {isAuthorized && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative w-full max-w-lg mx-auto space-y-10"
          >
            {/* Header Section */}
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="text-center space-y-3"
            >
              <div className="inline-block px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold tracking-wider uppercase mb-2">
                Systém Tofako
              </div>
              <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
                Objednávkový systém
              </h1>
              <h2 className="text-lg md:text-xl font-medium text-slate-500">
                od Martin Gašpar
              </h2>
            </motion.div>

            {/* Buttons List (Stack) */}
            <div className="flex flex-col gap-3 w-full">
              {MENU_ITEMS.map((item, index) => (
                <MinimalButton
                  key={item.id}
                  label={item.label}
                  index={index}
                  disabled={isPending}
                  onClick={() => handleButtonClick(item.label)}
                />
              ))}
              
              <MinimalButton
                label="Odhlásiť zariadenie"
                index={MENU_ITEMS.length}
                disabled={isPending}
                onClick={handleLogout}
                className="mt-4 border-destructive/20 hover:border-destructive/40"
              />
              
              {activeBranch && (
                <div className="flex items-center justify-center gap-2 px-4 py-2 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-sm font-medium mt-2">
                  <Check className="w-4 h-4" />
                  Aktívna prevádzka: {activeBranch}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isAdminDialogOpen} onOpenChange={(open) => {
        if (isAuthorized) setIsAdminDialogOpen(open);
      }}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => !isAuthorized && e.preventDefault()} onEscapeKeyDown={(e) => !isAuthorized && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Vyžaduje sa admin kód</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input
              type="password"
              placeholder="Zadajte kód"
              value={adminInput}
              onChange={(e) => setAdminInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verifyAdminCode()}
              autoFocus
            />
          </div>
          <DialogFooter className="flex flex-row gap-2 sm:justify-end">
            {isAuthorized && (
              <Button variant="ghost" onClick={() => setIsAdminDialogOpen(false)}>
                Zrušiť
              </Button>
            )}
            <Button onClick={verifyAdminCode} disabled={isPending} className="w-full sm:w-auto">
              Potvrdiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isBranchDialogOpen} onOpenChange={setIsBranchDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Výber prevádzky</DialogTitle>
          </DialogHeader>
          <div className="py-6">
            <Select value={selectedBranch} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-full bg-white">
                <SelectValue placeholder="Vyberte prevádzku" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                {prevadzky.map((branch) => (
                  <SelectItem key={branch} value={branch}>
                    {branch}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button onClick={saveBranch} disabled={!selectedBranch || isPending} className="w-full">
              Uložiť prevádzku
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-primary" />
              Vyberte dátum objednávky
            </DialogTitle>
          </DialogHeader>
          <div className="py-6 grid grid-cols-1 gap-2">
            {datumy.map((date) => (
              <Button 
                key={date} 
                variant="outline" 
                onClick={() => saveDate(date)}
                className="justify-start text-left h-12 text-base hover:bg-primary/5 hover:text-primary hover:border-primary/30 transition-all"
              >
                {date}
              </Button>
            ))}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDateDialogOpen(false)} className="w-full">
              Zrušiť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isNewOrderDialogOpen} onOpenChange={(open) => {
        setIsNewOrderDialogOpen(open);
        if (!open) {
          setIsEditing(false);
          setEditingOrderId(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {isEditing ? <Edit2 className="w-5 h-5 text-primary" /> : <Plus className="w-5 h-5 text-primary" />}
              {isEditing ? "Upraviť objednávku" : "Nová objednávka"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-6">
            {/* Date and Order Number Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-2 border-b">
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2">
                  <Calendar className="w-3 h-3" /> Dátum
                </Label>
                <div className="text-lg font-bold text-slate-900">
                  {selectedDate}
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] uppercase font-bold text-slate-500 flex items-center gap-2">
                  <Package className="w-3 h-3" /> Číslo objednávky
                </Label>
                <div className="text-lg font-bold text-slate-900">
                  #{orderNumber}
                </div>
              </div>
            </div>

            {/* Customer Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-bold flex items-center gap-2">
                  <User className="w-4 h-4" /> Meno a Priezvisko
                </Label>
                <Input 
                  id="name" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)} 
                  placeholder="Meno zákazníka"
                  className="h-10 text-base"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-bold flex items-center gap-2">
                  <Phone className="w-4 h-4" /> Telefónne číslo
                </Label>
                <Input 
                  id="phone" 
                  value={customerPhone} 
                  onChange={(e) => setCustomerPhone(e.target.value)} 
                  placeholder="09xx xxx xxx"
                  className="h-10 text-base"
                />
              </div>
            </div>

            {/* Payment Status Section */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
              <Label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Stav platby</Label>
              <div className="flex gap-4">
                <Button 
                  type="button"
                  variant={paymentStatus === "Paid" ? "default" : "outline"}
                  onClick={() => setPaymentStatus("Paid")}
                  className="flex-1 h-10 text-base font-semibold"
                >
                  Zaplatené
                </Button>
                <Button 
                  type="button"
                  variant={paymentStatus === "Unpaid" ? "destructive" : "outline"}
                  onClick={() => setPaymentStatus("Unpaid")}
                  className="flex-1 h-10 text-base font-semibold"
                >
                  Nezaplatené
                </Button>
              </div>
            </div>

            {/* Report Type Section */}
            <div className="space-y-3 p-4 bg-slate-50 rounded-lg border">
              <Label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Hlásenie</Label>
              <div className="flex gap-4">
                <Button 
                  type="button"
                  variant={reportType === "Order" ? "default" : "outline"}
                  onClick={() => setReportType("Order")}
                  className="flex-1 h-10 text-base font-semibold"
                >
                  Objednávka
                </Button>
                <Button 
                  type="button"
                  variant={reportType === "FreeSale" ? "default" : "outline"}
                  onClick={() => setReportType("FreeSale")}
                  className="flex-1 h-10 text-base font-semibold"
                >
                  Voľný predaj
                </Button>
              </div>
            </div>

            {/* Global Order Note */}
            <div className="space-y-2">
              <Label htmlFor="order-note" className="text-sm font-bold flex items-center gap-2">
                Poznámka k objednávke
              </Label>
              <textarea 
                id="order-note"
                value={orderNote}
                onChange={(e) => setOrderNote(e.target.value)}
                placeholder="Sem môžete napísať poznámku k celej objednávke..."
                className="w-full min-h-[80px] p-3 rounded-md border border-input bg-background text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              />
            </div>

            {/* Products List - Stacked vertically */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <Label className="flex items-center gap-2">
                  <Package className="w-4 h-4" /> Produkty
                </Label>
              </div>
              
              <div className="space-y-4 mt-4">
                {orderProducts.map((p, index) => (
                  <div key={index} className="p-4 border rounded-lg bg-slate-50/50 space-y-3 relative group">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-sm text-primary">{p.name} - {p.price}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-500">Počet kusov (len čísla)</Label>
                        <Input 
                          type="number" 
                          value={p.quantity} 
                          onChange={(e) => updateProductQuantity(index, e.target.value)}
                          placeholder="0"
                          className="h-11 text-lg bg-white border-primary/20 focus:border-primary"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-bold text-slate-500">Poznámka k produktu</Label>
                        <Input 
                          value={p.note} 
                          onChange={(e) => updateProductNote(index, e.target.value)}
                          placeholder="Poznámka..."
                          className="h-11 bg-white border-slate-200"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setIsNewOrderDialogOpen(false)} className="flex-1">
              Zrušiť
            </Button>
            <Button onClick={handleSubmitOrder} disabled={isPending} className="flex-1">
              {isPending ? "Ukladám..." : isEditing ? "Uložiť zmeny" : "Uložiť objednávku"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Preview Dialog */}
      <Dialog open={isOrderPreviewOpen} onOpenChange={(open) => { if (!open) setIsOrderPreviewOpen(false); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Check className="w-5 h-5 text-primary" />
              {isEditing ? "Skontrolovať zmeny" : "Skontrolovať objednávku"}
            </DialogTitle>
            <DialogDescription>
              Skontrolujte zadané údaje pred uložením.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2 space-y-4">
            {/* Header info */}
            <div className="rounded-xl border bg-slate-50 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Číslo objednávky</span>
                <span className="text-lg font-bold text-primary">#{orderNumber}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Meno zákazníka</span>
                <span className="font-semibold text-slate-800">{customerName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Telefón</span>
                <span className="text-slate-700">{customerPhone}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Platba</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {paymentStatus === "Paid" ? "Zaplatené" : "Nezaplatené"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Hlásenie</span>
                <span className="text-slate-700">{reportType === "Order" ? "Objednávka" : reportType === "FreeSale" ? "Voľný predaj" : reportType}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Dátum</span>
                <span className="text-slate-700">{selectedDate}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Prevádzka</span>
                <span className="text-slate-700">{activeBranch}</span>
              </div>
            </div>

            {/* Products */}
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Položky</p>
              <ul className="divide-y divide-slate-100 rounded-xl border overflow-hidden">
                {orderProducts.filter(p => Number(p.quantity) > 0).map((p, i) => (
                  <li key={i} className="flex items-center justify-between px-4 py-2.5 bg-white">
                    <div>
                      <span className="font-medium text-slate-800">{p.name}</span>
                      {p.note && <span className="ml-2 text-sm text-slate-500 italic">({p.note})</span>}
                    </div>
                    <span className="font-bold text-primary text-sm">×{p.quantity}</span>
                  </li>
                ))}
                {orderProducts.filter(p => Number(p.quantity) > 0).length === 0 && (
                  <li className="px-4 py-3 text-slate-400 italic text-sm">Žiadne položky s nenulovou hodnotou.</li>
                )}
              </ul>
            </div>

            {/* Order note */}
            {orderNote && (
              <div className="space-y-1">
                <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Poznámka k objednávke</p>
                <p className="rounded-xl border bg-slate-50 px-4 py-3 text-slate-700 text-sm whitespace-pre-wrap">{orderNote}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsOrderPreviewOpen(false)}
              className="flex-1"
              data-testid="button-preview-back"
            >
              <Edit2 className="w-4 h-4 mr-2" />
              Upraviť
            </Button>
            <Button
              onClick={confirmSaveOrder}
              disabled={isPending}
              className="flex-1"
              data-testid="button-preview-confirm"
            >
              {isPending ? "Ukladám..." : <><Save className="w-4 h-4 mr-2" />{isEditing ? "Uložiť zmeny" : "Uložiť objednávku"}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isStatusConfirmOpen} onOpenChange={setIsStatusConfirmOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Zmeniť status objednávky?</AlertDialogTitle>
            <AlertDialogDescription>
              Naozaj chcete označiť objednávku #{orderToUpdateStatus?.orderNumber} ako {orderToUpdateStatus?.deliveryStatus === "Vydaná" ? "Nevydaná" : "Vydaná"}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                confirmToggleDeliveryStatus();
              }} 
              disabled={isPending}
            >
              {isPending ? "Ukladám..." : "Potvrdiť"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent className="bg-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Naozaj chcete zmazať túto objednávku?</AlertDialogTitle>
            <AlertDialogDescription>
              Táto akcia je nevratná. Objednávka #{orderToDelete?.orderNumber} pre zákazníka {orderToDelete?.customerName} bude natrvalo odstránená.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Zrušiť</AlertDialogCancel>
            <AlertDialogAction 
              onClick={(e) => {
                e.preventDefault();
                handleDeleteOrder();
              }} 
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isPending ? "Mažem..." : "Zmazať objednávku"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isImportDialogOpen} onOpenChange={setIsImportDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle>Import položiek</DialogTitle>
          </DialogHeader>
          <div className="py-6 space-y-4">
            <p className="text-sm text-slate-500">
              Vyberte .txt súbor so zoznamom položiek (každá položka na novom riadku).
              <strong> Staré položky budú vymazané!</strong>
            </p>
            <Input
              type="file"
              accept=".txt"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
              className="bg-white"
            />
          </div>
          <DialogFooter>
            <Button 
              onClick={handleImportFile} 
              disabled={!importFile || isPending} 
              className="w-full"
            >
              Spustiť import
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!validationError} onOpenChange={(open) => !open && setValidationError(null)}>
        <DialogContent className="sm:max-w-md bg-white border-destructive">
          <DialogHeader>
            <DialogTitle className="text-destructive font-bold">Chyba</DialogTitle>
          </DialogHeader>
          <div className="py-4 text-slate-700 font-medium">
            {validationError}
          </div>
          <DialogFooter>
            <Button 
              variant="destructive" 
              onClick={() => setValidationError(null)}
              className="w-full"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!successMessage} onOpenChange={(open) => !open && setSuccessMessage(null)}>
        <DialogContent className="sm:max-w-md bg-white border-emerald-500">
          <DialogHeader>
            <DialogTitle className="text-emerald-600 font-bold flex items-center gap-2">
              <Check className="w-5 h-5" /> Úspech
            </DialogTitle>
          </DialogHeader>
          <div className="py-4 text-slate-700 font-medium text-center text-lg">
            {successMessage}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={isOdbytDialogOpen} onOpenChange={setIsOdbytDialogOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Objednávky na ODBYT
            </DialogTitle>
            <DialogDescription>
              {selectedDate} - {activeBranch}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const data = getOdbytData();
            return (
              <div className="py-4 space-y-6">
                <div>
                  <h3 className="text-sm font-bold uppercase text-primary mb-3 pb-1 border-b">Objednávka</h3>
                  <div className="space-y-2">
                    {Object.entries(data.orderTotals).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Žiadne položky</p>
                    ) : (
                      Object.entries(data.orderTotals).map(([name, qty]) => (
                        <div key={name}>
                          <div className="flex justify-between text-sm font-medium p-2 bg-slate-50 rounded border border-slate-100">
                            <span>{name}</span>
                            <span className="text-primary font-bold">{qty} ks</span>
                          </div>
                          {data.orderProductNotes[name] && data.orderProductNotes[name].length > 0 && (
                            <div className="ml-3 mt-1 space-y-1">
                              {data.orderProductNotes[name].map((note, i) => (
                                <p key={i} className="text-sm text-slate-500 font-medium italic">— {note}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {data.orderNotes.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Poznámky k objednávkam</p>
                      <div className="space-y-1">
                        {data.orderNotes.map((note, i) => (
                          <p key={i} className="text-sm font-medium text-slate-600 bg-slate-50 p-2 rounded border italic">{note}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-bold uppercase text-primary mb-3 pb-1 border-b">Voľný predaj</h3>
                  <div className="space-y-2">
                    {Object.entries(data.freeSaleTotals).length === 0 ? (
                      <p className="text-xs text-slate-400 italic">Žiadne položky</p>
                    ) : (
                      Object.entries(data.freeSaleTotals).map(([name, qty]) => (
                        <div key={name}>
                          <div className="flex justify-between text-sm font-medium p-2 bg-slate-50 rounded border border-slate-100">
                            <span>{name}</span>
                            <span className="text-primary font-bold">{qty} ks</span>
                          </div>
                          {data.freeSaleProductNotes[name] && data.freeSaleProductNotes[name].length > 0 && (
                            <div className="ml-3 mt-1 space-y-1">
                              {data.freeSaleProductNotes[name].map((note, i) => (
                                <p key={i} className="text-sm text-slate-500 font-medium italic">— {note}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                  {data.freeSaleNotes.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-slate-200">
                      <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Poznámky k objednávkam</p>
                      <div className="space-y-1">
                        {data.freeSaleNotes.map((note, i) => (
                          <p key={i} className="text-sm font-medium text-slate-600 bg-slate-50 p-2 rounded border italic">{note}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button onClick={() => setIsOdbytDialogOpen(false)} className="w-full">Zavrieť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isOrdersOverviewOpen} onOpenChange={(open) => {
        setIsOrdersOverviewOpen(open);
        if (!open) {
          setSearchQuery("");
        }
      }}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <Package className="w-6 h-6 text-primary" />
              Prehľad objednávok - {selectedDate}
            </DialogTitle>
            <DialogDescription>
              {activeBranch}
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Hľadať podľa mena alebo čísla objednávky..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-11 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
              />
            </div>

            <div className="flex gap-2">
                <Button
                  variant={overviewFilter === "All" ? "default" : "outline"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setOverviewFilter("All")}
                  data-testid="button-filter-all"
                >
                  Všetky
                </Button>
                <Button
                  variant={overviewFilter === "Delivered" ? "default" : "outline"}
                  size="sm"
                  className={`flex-1 ${overviewFilter === "Delivered" ? "" : "text-emerald-700 border-emerald-200 bg-emerald-50 hover:bg-emerald-100"}`}
                  onClick={() => setOverviewFilter("Delivered")}
                  data-testid="button-filter-delivered"
                >
                  Vydané
                </Button>
                <Button
                  variant={overviewFilter === "Undelivered" ? "default" : "outline"}
                  size="sm"
                  className={`flex-1 ${overviewFilter === "Undelivered" ? "" : "text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100"}`}
                  onClick={() => setOverviewFilter("Undelivered")}
                  data-testid="button-filter-undelivered"
                >
                  Nevydané
                </Button>
            </div>

            {filteredOrders.length === 0 ? (
              <div className="text-center py-12 bg-slate-50 rounded-lg border-2 border-dashed">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">
                  {searchQuery ? "Nenašli sa žiadne objednávky vyhovujúce vyhľadávaniu." : "Žiadne objednávky pre tento dátum."}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="p-4 rounded-xl border bg-card hover:shadow-md transition-shadow space-y-3 cursor-pointer" onClick={() => setSelectedOrderDetail(order)} data-testid={`card-order-${order.id}`}>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-bold text-primary">#{order.orderNumber}</span>
                          <h3 className="font-bold text-slate-900">{order.customerName}</h3>
                        </div>
                        <p className="text-sm text-slate-500 flex items-center gap-1">
                          <Phone className="w-3 h-3" /> {order.customerPhone}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <div className="flex gap-2">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={order.deliveryStatus === "Vydaná" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-amber-50 text-amber-700 border-amber-100"}
                            onClick={(e) => { e.stopPropagation(); handleToggleDeliveryStatus(order); }}
                            disabled={isPending}
                          >
                            {order.deliveryStatus}
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-slate-400 hover:text-primary"
                            onClick={(e) => { e.stopPropagation(); handleEditOrder(order); }}
                            data-testid={`button-edit-order-${order.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-slate-400 hover:text-destructive"
                            onClick={(e) => { e.stopPropagation(); setOrderToDelete(order); setIsDeleteDialogOpen(true); }}
                            data-testid={`button-delete-order-${order.id}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          order.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                        }`}
                        data-testid={`status-payment-${order.id}`}
                        >
                          {order.paymentStatus === "Paid" ? "Zaplatené" : "Nezaplatené"}
                        </span>
                        <span className="text-[10px] font-medium text-slate-400">
                          {new Date(order.createdAt).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
                      <div className="space-y-2">
                        <p className="text-[10px] font-bold uppercase text-slate-400">Položky</p>
                        <ul className="divide-y divide-slate-200">
                          {order.products.filter((p: any) => Number(p.quantity) > 0).map((p: any, i: number) => (
                            <li key={i} className="text-sm flex justify-between gap-4 py-2">
                              <span className="text-slate-700 font-medium" data-testid={`text-product-${order.id}-${i}`}>
                                {p.quantity}x {p.name}
                              </span>
                              {p.note && <span className="text-sm text-slate-500 font-medium italic">({p.note})</span>}
                            </li>
                          ))}
                        </ul>
                      </div>
                      {order.note && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase text-slate-400">Poznámka</p>
                          <p className="text-base font-medium text-slate-600 bg-slate-50 p-3 rounded border italic" data-testid={`text-note-${order.id}`}>
                            {order.note}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          <DialogFooter>
            <Button onClick={() => setIsOrdersOverviewOpen(false)} className="w-full sm:w-auto">
              Zavrieť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrderDetail} onOpenChange={(open) => { if (!open) setSelectedOrderDetail(null); }}>
        <DialogContent className="sm:max-w-lg bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <Package className="w-5 h-5 text-primary" />
              Objednávka #{selectedOrderDetail?.orderNumber}
            </DialogTitle>
            <DialogDescription>{activeBranch} — {selectedDate}</DialogDescription>
          </DialogHeader>
          {selectedOrderDetail && (
            <div className="py-2 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Zákazník</p>
                  <p className="font-semibold text-slate-900">{selectedOrderDetail.customerName}</p>
                  {selectedOrderDetail.customerPhone && (
                    <p className="text-sm text-slate-500 flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{selectedOrderDetail.customerPhone}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-bold ${selectedOrderDetail.deliveryStatus === "Vydaná" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {selectedOrderDetail.deliveryStatus}
                  </span>
                  <span className={`inline-block ml-2 px-2 py-1 rounded-full text-xs font-bold ${selectedOrderDetail.paymentStatus === "Paid" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                    {selectedOrderDetail.paymentStatus === "Paid" ? "Zaplatené" : "Nezaplatené"}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Typ</p>
                  <p className="text-sm font-medium text-slate-700">{selectedOrderDetail.reportType === "Order" ? "Objednávka" : "Voľný predaj"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Čas</p>
                  <p className="text-sm text-slate-500">{new Date(selectedOrderDetail.createdAt).toLocaleTimeString('sk-SK', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase text-slate-400 mb-2">Položky</p>
                <ul className="divide-y divide-slate-100 rounded-lg border bg-slate-50 overflow-hidden">
                  {selectedOrderDetail.products.filter((p: any) => Number(p.quantity) > 0).map((p: any, i: number) => (
                    <li key={i} className="flex justify-between items-start px-3 py-2 text-sm">
                      <span className="font-medium text-slate-800">{p.quantity}× {p.name}</span>
                      {p.note && <span className="text-slate-500 italic ml-2">({p.note})</span>}
                    </li>
                  ))}
                  {selectedOrderDetail.products.filter((p: any) => Number(p.quantity) > 0).length === 0 && (
                    <li className="px-3 py-2 text-sm text-slate-400 italic">Žiadne položky</li>
                  )}
                </ul>
              </div>
              {selectedOrderDetail.note && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400 mb-1">Poznámka</p>
                  <p className="text-sm text-slate-700 bg-slate-50 border rounded-lg p-3 italic">{selectedOrderDetail.note}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { if (selectedOrderDetail) { handleEditOrder(selectedOrderDetail); setSelectedOrderDetail(null); } }} className="gap-2">
              <Edit2 className="w-4 h-4" /> Upraviť
            </Button>
            <Button onClick={() => setSelectedOrderDetail(null)}>Zavrieť</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Informácie Dialog */}
      <Dialog open={isInfoDialogOpen} onOpenChange={(open) => {
        if (!open) { setIsInfoDialogOpen(false); setInfoEditStep("view"); setInfoAdminInput(""); }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl font-bold">
              <Info className="w-6 h-6 text-primary" />
              Informácie
            </DialogTitle>
            <DialogDescription>{activeBranch}</DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-4">

            {/* VIEW MODE */}
            {infoEditStep === "view" && (
              <>
                <div className="min-h-[120px] rounded-xl border bg-slate-50 p-4 text-slate-800 text-base whitespace-pre-wrap leading-relaxed">
                  {infoText.trim() ? infoText : <span className="text-slate-400 italic">Žiadny text.</span>}
                </div>
                <Button
                  variant="outline"
                  className="flex items-center gap-2"
                  onClick={() => setInfoEditStep("admin")}
                  data-testid="button-info-edit"
                >
                  <Pencil className="w-4 h-4" />
                  Upraviť
                </Button>
              </>
            )}

            {/* ADMIN CODE STEP */}
            {infoEditStep === "admin" && (
              <div className="space-y-4">
                <p className="text-slate-600 text-sm">Pre úpravu textu zadajte admin kód:</p>
                <div className="space-y-2">
                  <Label htmlFor="info-admin-code">Admin kód</Label>
                  <Input
                    id="info-admin-code"
                    type="password"
                    placeholder="Zadajte admin kód..."
                    value={infoAdminInput}
                    onChange={(e) => setInfoAdminInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && verifyInfoAdminCode()}
                    data-testid="input-info-admin-code"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={verifyInfoAdminCode}
                    disabled={isPending || !infoAdminInput.trim()}
                    data-testid="button-info-admin-confirm"
                  >
                    {isPending ? "Overujem..." : "Potvrdiť"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setInfoEditStep("view"); setInfoAdminInput(""); }}
                    data-testid="button-info-admin-cancel"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Zrušiť
                  </Button>
                </div>
              </div>
            )}

            {/* EDIT MODE */}
            {infoEditStep === "edit" && (
              <div className="space-y-4">
                <Textarea
                  value={infoEditText}
                  onChange={(e) => setInfoEditText(e.target.value)}
                  placeholder="Zadajte text informácií..."
                  className="min-h-[200px] text-base leading-relaxed resize-y"
                  data-testid="textarea-info-edit"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleSaveInfoText}
                    disabled={isInfoSaving}
                    data-testid="button-info-save"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isInfoSaving ? "Ukladám..." : "Uložiť"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setInfoEditStep("view"); setInfoEditText(infoText); }}
                    data-testid="button-info-cancel"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Zrušiť
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsInfoDialogOpen(false)} className="w-full sm:w-auto">
              Zavrieť
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
