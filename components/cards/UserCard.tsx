import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { UserType } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Image from "next/image";

const UserCard = ({
  user,
  showBio = false,
  className,
}: {
  user: UserType;
  showBio?: boolean;
  className?: string;
}): ReactNode => {
  const { name, bio, profile_picture } = user;

  return (
    <Card
      className={cn(
        "user-card overflow-hidden border-none text-center shadow-none transition-all duration-200 ease-in-out hover:-translate-y-3",
        "[&>*]:px-0 [&_.user-media]:transition-all  [&_.user-media]:duration-500 [&_.user-media]:ease-in-out [&_.user-media]:hover:grayscale",
        className,
      )}
      title={name}
    >
      <CardHeader className="card-header overflow-hidden rounded-sm px-0">
        <div className="user-media relative mx-auto aspect-square h-64 rounded-sm">
          <Image
            src={profile_picture}
            height={250}
            width={250}
            alt={name || "Seller Profile Picture"}
            className="user-img h-full w-full rounded-sm object-cover object-top"
          />
        </div>
      </CardHeader>
      <CardContent className="card-content grid gap-1 p-0">
        <CardTitle className="user-title line-clamp-2 font-bold md:text-xl">
          {name}
        </CardTitle>
        {showBio && (
          <CardDescription className="line-clamp-2 text-muted-foreground">
            {bio}
          </CardDescription>
        )}
      </CardContent>
    </Card>
  );
};

export default UserCard;
