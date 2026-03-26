import { useQueryClient } from "@tanstack/react-query";
import { 
  useListTickets, 
  useCreateTicket, 
  useUpdateTicket, 
  useDeleteTicket,
  getListTicketsQueryKey
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";

export function useTicketsManager() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useListTickets();

  const createMutation = useCreateTicket({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
        toast({
          title: "Ticket created",
          description: "Your new ticket has been successfully submitted.",
        });
      },
      onError: (error) => {
        toast({
          title: "Error creating ticket",
          description: error.message || "Something went wrong.",
          variant: "destructive",
        });
      }
    }
  });

  const updateMutation = useUpdateTicket({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
        toast({
          title: "Ticket updated",
          description: "The ticket has been successfully updated.",
        });
      },
      onError: (error) => {
        toast({
          title: "Error updating ticket",
          description: error.message || "Something went wrong.",
          variant: "destructive",
        });
      }
    }
  });

  const deleteMutation = useDeleteTicket({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTicketsQueryKey() });
        toast({
          title: "Ticket deleted",
          description: "The ticket has been removed from the system.",
        });
      },
      onError: (error) => {
        toast({
          title: "Error deleting ticket",
          description: error.message || "Something went wrong.",
          variant: "destructive",
        });
      }
    }
  });

  return {
    tickets: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    createTicket: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    updateTicket: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteTicket: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  };
}
