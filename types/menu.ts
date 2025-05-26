export type NavLink = {
  title: string;
  href: string;
  openInNewTab?: boolean;
  subMenu?: NavLink[];
  icon?: string;
  tags?: string[];
};
