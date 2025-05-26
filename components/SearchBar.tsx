import React from "react";
import { cn } from "@/lib/utils";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SearchBar = ({
  className,
  inputClassName,
  btnClassName,
}: {
  className?: string;
  inputClassName?: string;
  btnClassName?: string;
}) => {
  return (
    <form
      action="/search"
      className={cn("flex items-center space-x-2 rounded-md", className)}
    >
      <Input
        className={cn(
          "search-input bg-transparent font-quaternary text-white !placeholder-white",
          inputClassName,
        )}
        type="text"
        placeholder="Search..."
        required
        name="q"
      />
      <Button
        variant="ghost"
        className="search-btn btn-close !bg-transparent opacity-65 hover:opacity-100 focus-visible:opacity-100"
      >
        <Search
          className={cn("search-icon flex-none !text-white", btnClassName)}
        />
      </Button>
    </form>
  );
};

export default SearchBar;
