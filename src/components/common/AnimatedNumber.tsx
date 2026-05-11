import { animate, useMotionValue, useTransform, motion } from "framer-motion";
import { useEffect } from "react";

export function AnimatedNumber({
  value,
  digits = 2,
  className,
  prefix = "",
  suffix = "",
}: {
  value: number;
  digits?: number;
  className?: string;
  prefix?: string;
  suffix?: string;
}) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (v) =>
    `${prefix}${v.toLocaleString("en-US", {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })}${suffix}`,
  );

  useEffect(() => {
    const controls = animate(mv, value, { duration: 0.8, ease: "easeOut" });
    return () => controls.stop();
  }, [value, mv]);

  return <motion.span className={className}>{rounded}</motion.span>;
}
