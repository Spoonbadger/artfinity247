"use client";

import { ChangeEvent, Dispatch, SetStateAction } from "react";
import { cn } from "@/lib/utils";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProductQuantityInputProps = {
  title?: string;
  quantity: number;
  setQuantity: (value: number) => void
  handleRemove?: () => void;
  minQuantity?: number;
  maxQuantity?: number;
  step?: number;
  inputDisabled?: boolean;
  btnsDisabled?: boolean;
  showRemoveBtn?: boolean;
  className?: string;
}

const ProductQuantityInput = ({
  title,
  quantity,
  setQuantity,
  handleRemove = () => {},
  minQuantity = 1,
  maxQuantity = 100,
  step = 1,
  inputDisabled = false,
  btnsDisabled = false,
  showRemoveBtn = false,
  className,
}: ProductQuantityInputProps) => {
  const handleIncrement = () =>
    setQuantity(quantity + step <= maxQuantity ? quantity + step : maxQuantity);

  const handleDecrement = () =>
    setQuantity(quantity - step >= minQuantity ? quantity - step : minQuantity);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10);
    if (isNaN(value)) {
      setQuantity(minQuantity);
    } else if (value < minQuantity) {
      setQuantity(minQuantity);
    } else if (value > maxQuantity) {
      setQuantity(maxQuantity);
    } else {
      setQuantity(value);
    }
  };

  return (
    <div
      className={cn(
        "action-btns flex items-center space-x-2 md:col-span-1",
        className,
      )}
    >
      <div className="input-area flex flex-col gap-2">
        {title && <Label className="capitalize">{title}</Label>}
        <div
          className={cn(
            "inline-flex max-w-fit items-center rounded-lg border border-theme-primary/50",
            "[&>*]:!border-none [&>*]:!bg-transparent [&>*]:!py-3",
          )}
          role="group"
        >
          <Button
            onClick={handleDecrement}
            disabled={btnsDisabled || quantity === minQuantity}
            className="rounded-none first:rounded-s-lg last:rounded-e-lg"
          >
            <Minus />
          </Button>
          <Input
            type="number"
            value={quantity}
            onChange={handleInputChange}
            className="arrow-hide w-16 rounded-none text-center !opacity-100 first:rounded-s-lg last:rounded-e-lg"
            disabled={inputDisabled}
            min={minQuantity}
            max={maxQuantity}
            step={step}
          />
          <Button
            onClick={handleIncrement}
            disabled={btnsDisabled || quantity === maxQuantity}
            className="rounded-none first:rounded-s-lg last:rounded-e-lg"
          >
            <Plus />
          </Button>
        </div>
      </div>
      <div className="rempve-area">
        {showRemoveBtn && (
          <Button onClick={handleRemove} variant="ghost">
            <Trash2 className="remove-btn size-5 text-red-500 hover:text-red-700" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default ProductQuantityInput;
