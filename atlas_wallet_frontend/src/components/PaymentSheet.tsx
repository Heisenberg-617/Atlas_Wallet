import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ShoppingCart, Loader2, Star, Truck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { atlasAddToCart } from "@/lib/atlasBackend";

type Product = {
  product_id?: string;
  name: string;
  brand: string;
  price_mad: number;
  emoji: string;
  rating?: number;
  delivery_days?: number;
  key_specs?: string[];
  why?: string;
};

export default function PaymentSheet({
  product,
  onClose,
  onSuccess,
}: {
  product: Product | null;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const { user } = useAuth();

  if (!product) return null;

  const addToCart = async () => {
    if (!product.product_id) {
      toast.error("This product cannot be added (missing catalog id).");
      return;
    }
    if (!user) {
      toast.error("You must be signed in.");
      return;
    }
    setBusy(true);
    try {
      await atlasAddToCart(user.id, product.product_id, 1);
      toast.success("Added to cart");
      onSuccess();
      onClose();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not add to cart");
    } finally {
      setBusy(false);
    }
  };

  const rating = typeof product.rating === "number" ? product.rating : 4.5;
  const delivery = product.delivery_days ?? 3;

  return (
    <Sheet open={!!product} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto p-0">
        <div className="px-6 pt-6 pb-4 border-b">
          <SheetHeader className="text-left">
            <SheetTitle className="font-display text-2xl">Product</SheetTitle>
            <SheetDescription>Add this offer to your cart, then confirm purchase on the Cart tab.</SheetDescription>
          </SheetHeader>
          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-secondary p-3">
            <div className="h-12 w-12 rounded-xl bg-primary-soft grid place-items-center text-2xl">{product.emoji}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">{product.brand}</div>
              <div className="font-semibold truncate">{product.name}</div>
            </div>
            <div className="font-display font-bold text-lg">
              {product.price_mad.toLocaleString()} <span className="text-xs text-muted-foreground">MAD</span>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Star className="h-3.5 w-3.5 fill-warning text-warning" />
              {rating.toFixed(1)}
            </span>
            <span className="flex items-center gap-1">
              <Truck className="h-3.5 w-3.5" />
              Est. {delivery}d delivery
            </span>
          </div>
          {product.key_specs && product.key_specs.length > 0 && (
            <ul className="mt-3 text-xs text-muted-foreground space-y-1 list-disc pl-4">
              {product.key_specs.slice(0, 4).map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          )}
          {product.why && <p className="mt-3 text-xs italic text-muted-foreground">"{product.why}"</p>}
        </div>

        <div className="p-6">
          <Button
            onClick={() => void addToCart()}
            disabled={busy}
            className="w-full h-12 gradient-primary text-primary-foreground hover:opacity-90 shadow-glow rounded-2xl"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Adding…
              </>
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to cart
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted-foreground mt-3">Demo catalog — pay from Cart when ready.</p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
