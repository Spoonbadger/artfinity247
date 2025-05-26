export type ActionButtonType = {
  title: string;
  href: string;
  openInNewTab?: boolean;
  className?: string;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link"
    | null;
  icon?: string;
  iconPos?: "start" | "end";
};
