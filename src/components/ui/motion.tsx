'use client'

/**
 * Shared motion primitives built on framer-motion. Use these instead of hand-rolling
 * variants so reveal/stagger timing stays consistent across the app.
 *
 * Reduced motion is honoured globally via <MotionConfig reducedMotion="user"> in
 * providers.tsx — framer drops the transforms automatically when the OS asks for it.
 *
 *   <Stagger>            // container: cascades its direct children in
 *     <StaggerItem>…</StaggerItem>
 *     <StaggerItem>…</StaggerItem>
 *   </Stagger>
 *
 *   <FadeIn>…</FadeIn>   // one-off reveal for a single block
 */
import { motion, type Variants } from 'framer-motion'

const EASE_SPRING = { type: 'spring', stiffness: 260, damping: 26 } as const

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.04 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: EASE_SPRING },
}

type DivProps = React.ComponentProps<typeof motion.div>

export function Stagger({ children, ...props }: DivProps) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" {...props}>
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, ...props }: DivProps) {
  return (
    <motion.div variants={itemVariants} {...props}>
      {children}
    </motion.div>
  )
}

export function FadeIn({ children, ...props }: DivProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={EASE_SPRING}
      {...props}
    >
      {children}
    </motion.div>
  )
}
