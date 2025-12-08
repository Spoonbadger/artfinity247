import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Search } from "lucide-react";
import SearchBar from "@/components/SearchBar";

const SearchArea = ({ className }: { className?: string }): ReactNode => {
  return (
    <div className={cn("", className)}>
      <Dialog modal={false}>
        <DialogTrigger asChild>
          <Button variant="ghost" className="btn-close !bg-transparent px-2">
            <Search className="search-icon size-5 flex-none text-gray-300" />
          </Button>
        </DialogTrigger>
        <DialogContent className="search-area box-shadow-none z-40 min-h-full min-w-full scale-[1.001]  !rounded-none !border-none  bg-theme-secondary-500 bg-opacity-95">
          <div className="flex h-1/2 items-center justify-center space-y-8 px-4 md:h-full md:space-x-6 md:space-y-0">
            <SearchBar
              inputClassName="text-theme-secondary-500 box-shadow-none h-full w-[10ch] appearance-none overflow-x-hidden border-none outline-none md:w-[8ch] text-3xl md:text-6xl"
              btnClassName="!size-5 md:!h-12 md:!w-12"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SearchArea;
