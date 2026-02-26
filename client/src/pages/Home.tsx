import { MinimalButton } from "@/components/MinimalButton";
import { motion, AnimatePresence } from "framer-motion";
const MENU_ITEMS = [
  { label: "Nová objednávka", icon: "PlusCircle", id: "new_order" },
  { label: "Prehľad objednávok", icon: "ClipboardList", id: "order_overview" },
  { label: "Vydané objednávky", icon: "CheckCircle2", id: "delivered_orders" },
  { label: "Nevydané objednávky", icon: "Clock", id: "pending_orders" },
  { label: "Objednávky na ODBYT", icon: "ShoppingCart", id: "sales_orders" },
  { label: "Výber prevádzky", icon: "Store", id: "select_branch" },
  { label: "Import položiek", icon: "FileDown", id: "import_items" }
];
import { getAdminCode, getPrevadzky, importProducts, getDatumy, getProducts, getNextOrderNumber, submitOrder, getOrders, deleteOrder, updateOrder } from "@/lib/firebase";
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
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LogOut, Check, Calendar, Plus, User, Phone, Package, Trash2, Edit2, Search } from "lucide-react";
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
  const [viewMode, setViewMode] = useState<"Overview" | "Delivered" | "Undelivered">("Overview");
  const [overviewFilter, setOverviewFilter] = useState<"All" | "Delivered" | "Undelivered">("All");

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      (order.customerName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.orderNumber || "").toString().includes(searchQuery);
    
    if (viewMode === "Delivered") return matchesSearch && order.deliveryStatus === "Vydaná";
    if (viewMode === "Undelivered") return matchesSearch && order.deliveryStatus === "Nevydaná";
    if (viewMode === "Overview") {
      if (overviewFilter === "Delivered") return matchesSearch && order.deliveryStatus === "Vydaná";
      if (overviewFilter === "Undelivered") return matchesSearch && order.deliveryStatus === "Nevydaná";
    }
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
      "Vydané objednávky", 
      "Nevydané objednávky", 
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

    if (pendingAction === "Prehľad objednávok" || pendingAction === "Vydané objednávky" || pendingAction === "Nevydané objednávky") {
      setIsPending(true);
      try {
        const fetchedOrders = await getOrders(activeBranch!, date);
        setOrders(fetchedOrders);
        if (pendingAction === "Prehľad objednávok") { setViewMode("Overview"); setOverviewFilter("All"); }
        else if (pendingAction === "Vydané objednávky") setViewMode("Delivered");
        else if (pendingAction === "Nevydané objednávky") setViewMode("Undelivered");
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

  const handleSubmitOrder = async () => {
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
        // Refresh orders if overview is open
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

    setIsPending(true);
    toast({
      title: "Úspech",
      description: `Akcia "${label}"${date ? ` pre dátum ${date}` : ""} bola zaznamenaná.`,
    });
    setIsPending(false);
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
              {viewMode === "Overview" ? "Prehľad objednávok" : viewMode === "Delivered" ? "Vydané objednávky" : "Nevydané objednávky"} - {selectedDate}
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

            {viewMode === "Overview" && (
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
            )}

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
                  <div key={order.id} className="p-4 rounded-xl border bg-card hover:shadow-md transition-shadow space-y-3">
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
                            onClick={() => handleToggleDeliveryStatus(order)}
                            disabled={isPending}
                          >
                            {order.deliveryStatus}
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-slate-400 hover:text-primary"
                            onClick={() => handleEditOrder(order)}
                            data-testid={`button-edit-order-${order.id}`}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-slate-400 hover:text-destructive"
                            onClick={() => {
                              setOrderToDelete(order);
                              setIsDeleteDialogOpen(true);
                            }}
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
                          {order.products.map((p: any, i: number) => (
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
    </div>
  );
}
