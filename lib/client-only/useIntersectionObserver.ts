"use client";

import { useEffect, useState, RefObject } from "react";

export const useIntersectionObserver = (
  ref: RefObject<any>,
  callback?: (entry: IntersectionObserverEntry) => void,
  options: IntersectionObserverInit = {},
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const currentRef = ref.current;
    if (!currentRef) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        setIsIntersecting(entry.isIntersecting);

        if (callback && entry.isIntersecting) {
          callback(entry);
        }
      });
    }, options);

    observer.observe(currentRef);

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [ref, callback, options]);

  return isIntersecting;
};
