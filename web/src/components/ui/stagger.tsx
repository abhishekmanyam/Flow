import { useRef } from "react";
import { motion } from "motion/react";
import type { Easing } from "motion/react";
import { cn } from "@/lib/utils";

const ease: Easing = "easeOut";

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.06,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease },
  },
};

export function StaggerContainer({
  children,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "ul" | "ol" | "section";
}) {
  const hasAnimated = useRef(false);
  const Component = motion.create(Tag);

  const shouldAnimate = !hasAnimated.current;
  if (shouldAnimate) hasAnimated.current = true;

  return (
    <Component
      variants={containerVariants}
      initial={shouldAnimate ? "hidden" : false}
      animate="show"
      className={cn(className)}
    >
      {children}
    </Component>
  );
}

export function StaggerItem({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
}) {
  return (
    <motion.div variants={itemVariants} className={cn(className)} onClick={onClick}>
      {children}
    </motion.div>
  );
}
