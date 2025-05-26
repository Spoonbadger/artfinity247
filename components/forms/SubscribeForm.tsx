"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { subscribeFormSchema, TSubscribeFormSchema } from "@/types";

const SubscribeForm = ({
  msg = "Receive e-mail updates on our products, events, and more",
  className,
}: {
  msg?: string;
  className?: string;
}): ReactNode => {
  const form = useForm<TSubscribeFormSchema>({
    resolver: zodResolver(subscribeFormSchema),
    defaultValues: {
      email: "",
    },
  });

  const handleSubmit: SubmitHandler<TSubscribeFormSchema> = async (values) => {
    toast.success("Subscribed successfully");

    setTimeout(() => {
      form.reset();
    }, 2000);
  };

  return (
    <div className={cn("area-content space-y-2", className)}>
      <div>{msg && <p className="area-text text-start text-xs">{msg}</p>}</div>
      <Form {...form}>
        <form
          method="POST"
          onSubmit={form.handleSubmit(handleSubmit)}
          className={cn(
            "subscribe-form",
            "[&_:where(.form-input,_.form-btn)]:p-3:rounded-md [&_:where(.form-input,_.form-btn)]:p-3",
          )}
        >
          <div className="relative">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      type="email"
                      placeholder="Your email address"
                      className="form-input !mt-0 mb-8 h-full w-full bg-white"
                    />
                  </FormControl>
                  <FormMessage className="area-text absolute left-0 top-full w-full" />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              variant="ghost"
              disabled={form.formState.isSubmitting}
              className="form-btn action-btn absolute right-0 top-1/2 mx-auto h-full -translate-y-1/2 rounded-none !border-none !bg-transparent uppercase opacity-65 !outline-none hover:opacity-100"
            >
              {form.formState.isSubmitting ? (
                <Loader2
                  strokeWidth={1.25}
                  className="mr-2 size-4 animate-spin"
                />
              ) : (
                <ArrowRight strokeWidth={1.25} />
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default SubscribeForm;
