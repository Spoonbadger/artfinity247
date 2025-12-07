import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { CollectionType } from "@/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_SCENE_IMG } from '@/lib/sceneImages'

const CollectionCard = ({
  collection,
  showDescription = false,
  featured = false,
  className,
}: {
  collection: CollectionType;
  showDescription?: boolean;
  featured?: boolean;
  className?: string;
}): ReactNode => {
  const { title, description, img } = collection;

  return (
    <Card
      className={cn(
        "collection-card overflow-hidden text-center",
        "[&_.collection-media]:hover:scale-105",
        className,
      )}
      title={title}
    >
      <CardHeader className="card-header overflow-hidden p-0">
        <div className="collection-media relative h-48 transition-all duration-200 ease-in">
          <Image
            src={img || DEFAULT_SCENE_IMG}
            height={250}
            width={250}
            alt={title}
            className="collection-img h-full w-full object-cover object-top"
          />
          <div className="product-badges">
            {featured && (
              <Badge
                variant="secondary"
                className="card-badge absolute left-2 top-2 rounded-full bg-slate-900 text-white"
              >
                Featured
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="card-content grid gap-1 py-3">
        <CardTitle className="collection-title line-clamp-2 font-bold md:text-xl text-theme-secondary-500">
          {title}
        </CardTitle>
        {showDescription && (
          <CardDescription className="line-clamp-2 text-muted-foreground">
            {description}
          </CardDescription>
        )}
      </CardContent>
    </Card>
  );
};

export default CollectionCard;
