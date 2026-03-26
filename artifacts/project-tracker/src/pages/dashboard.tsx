import { useState, useMemo } from "react";
import { Plus, Search, SlidersHorizontal, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTicketsManager } from "@/hooks/use-tickets-manager";
import { DashboardStats } from "@/components/dashboard-stats";
import { TicketTable } from "@/components/ticket-table";
import { TicketFormDialog } from "@/components/ticket-form-dialog";
import { US_STATES, CATEGORIES, STATUSES } from "@/lib/constants";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { tickets, isLoading } = useTicketsManager();
  
  // Local filter state
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Apply filters locally (could also be done via API params, but local is instant for small datasets)
  const filteredTickets = useMemo(() => {
    return tickets.filter((ticket) => {
      const matchesSearch = 
        search === "" || 
        ticket.title.toLowerCase().includes(search.toLowerCase()) ||
        ticket.submitter.toLowerCase().includes(search.toLowerCase());
      
      const matchesState = stateFilter === "all" || ticket.state === stateFilter;
      const matchesCat = categoryFilter === "all" || ticket.category === categoryFilter;
      const matchesStatus = statusFilter === "all" || ticket.status === statusFilter;

      return matchesSearch && matchesState && matchesCat && matchesStatus;
    });
  }, [tickets, search, stateFilter, categoryFilter, statusFilter]);

  const activeFiltersCount = 
    (stateFilter !== "all" ? 1 : 0) + 
    (categoryFilter !== "all" ? 1 : 0) + 
    (statusFilter !== "all" ? 1 : 0);

  const clearFilters = () => {
    setStateFilter("all");
    setCategoryFilter("all");
    setStatusFilter("all");
    setSearch("");
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header */}
      <header className="sticky top-0 z-40 w-full backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <LayersIcon className="w-5 h-5 text-primary-foreground" />
            </div>
            <h1 className="text-xl font-display font-bold text-foreground">Project Tracker</h1>
          </div>
          <div className="flex items-center gap-4">
            <TicketFormDialog trigger={
              <Button className="shadow-sm shadow-primary/20 hover:shadow-md transition-all rounded-full px-5">
                <Plus className="w-4 h-4 mr-2" />
                New Ticket
              </Button>
            } />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-8">
            <h2 className="text-3xl font-display font-bold tracking-tight text-foreground">Dashboard</h2>
            <p className="text-muted-foreground mt-1">Manage and track your regional project requests.</p>
          </div>

          <DashboardStats tickets={tickets} />

          {/* Filter Bar */}
          <div className="bg-card border border-border/50 rounded-2xl p-4 shadow-sm mb-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  placeholder="Search tickets or submitters..." 
                  className="pl-9 bg-background/50 border-border/60 rounded-xl"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  className={`rounded-xl w-full sm:w-auto ${activeFiltersCount > 0 ? 'border-primary/50 text-primary bg-primary/5' : ''}`}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  <SlidersHorizontal className="w-4 h-4 mr-2" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-primary/20 hover:bg-primary/20 rounded-md px-1.5 min-w-5 justify-center">
                      {activeFiltersCount}
                    </Badge>
                  )}
                </Button>
                {activeFiltersCount > 0 && (
                  <Button variant="ghost" size="icon" onClick={clearFilters} className="text-muted-foreground hover:text-foreground">
                    <X className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 mt-4 border-t border-border/40">
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground px-1">Status</label>
                      <Select value={statusFilter} onValueChange={setStatusFilter}>
                        <SelectTrigger className="bg-background/50 rounded-xl">
                          <SelectValue placeholder="All Statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Statuses</SelectItem>
                          {STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground px-1">State</label>
                      <Select value={stateFilter} onValueChange={setStateFilter}>
                        <SelectTrigger className="bg-background/50 rounded-xl">
                          <SelectValue placeholder="All States" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All States</SelectItem>
                          {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground px-1">Category</label>
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="bg-background/50 rounded-xl">
                          <SelectValue placeholder="All Categories" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Categories</SelectItem>
                          {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <TicketTable tickets={filteredTickets} isLoading={isLoading} />
        </motion.div>
      </main>
    </div>
  );
}

// Icon for the header
import { Layers as LayersIcon } from "lucide-react";
