"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { useIntersectionObserver } from "@/lib/utils";
import { AnimatedCounterCardType } from "@/types";

const AnimatedCounterCard = ({
  title,
  value,
  content,
  prefix,
  suffix,
  duration = 2000,
}: AnimatedCounterCardType): ReactNode => {
  const [count, setCount] = useState(0);
  const [hasAnimated, setHasAnimated] = useState(false);
  const counterRef = useRef<HTMLDivElement | null>(null);
  const isVisible = useIntersectionObserver(counterRef);

  useEffect(() => {
    if (isVisible && !hasAnimated) {
      setHasAnimated(true);
      let start = 0;
      const end = value;
      const startTime = performance.now();

      const updateCounter = (currentTime: number) => {
        const elapsedTime = currentTime - startTime;
        start = Math.min((elapsedTime / duration) * end, end);
        setCount(Math.ceil(start));

        if (elapsedTime < duration) {
          requestAnimationFrame(updateCounter);
        } else {
          setCount(end);
        }
      };

      requestAnimationFrame(updateCounter);
    }
  }, [isVisible, hasAnimated, value, duration]);

  return (
    <div className="area-counter text-center md:text-center" ref={counterRef}>
      <div className="counter-title text-3xl font-bold md:text-5xl">
        <span className="prefix text-xl md:text-4xl">{prefix}</span>
        <span className="count">{count}</span>
        <span className="suffix text-xl md:text-4xl">{suffix}</span>
      </div>
      <h3 className="area-title">{title}</h3>
      <p className="area-text text-muted-foreground">{content}</p>
    </div>
  );
};

export default AnimatedCounterCard;
