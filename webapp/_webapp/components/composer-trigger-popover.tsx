// Trigger-driven picker popover (slash commands) for the composer. Adapted from
// assistant-ui's shadcn registry component (r.assistant-ui.com/composer-trigger-
// popover) — same built-in ComposerPrimitive.Unstable_TriggerPopover* primitives,
// but restyled with our pd-* classes and ~icons instead of shadcn/lucide-react so
// it needs no cmdk/radix/shadcn deps.
import { memo, useRef, type ComponentPropsWithoutRef, type FC } from "react";
import {
  ComposerPrimitive,
  unstable_defaultDirectiveFormatter,
  unstable_useTriggerPopoverScopeContext,
  type Unstable_DirectiveFormatter,
  type Unstable_TriggerItem,
} from "@assistant-ui/react";
import IconChevronLeft from "~icons/lucide/chevron-left";
import IconSparkles from "~icons/lucide/sparkles";

type IconComponent = FC<{ className?: string }>;

type DirectiveBehaviorProps = {
  formatter?: Unstable_DirectiveFormatter | undefined;
  onInserted?: ((item: Unstable_TriggerItem) => void) | undefined;
};
type ActionBehaviorProps = {
  formatter?: Unstable_DirectiveFormatter | undefined;
  onExecute: (item: Unstable_TriggerItem) => void;
  removeOnExecute?: boolean | undefined;
};

type BaseProps = Omit<
  ComponentPropsWithoutRef<typeof ComposerPrimitive.Unstable_TriggerPopover>,
  "children"
> & {
  iconMap?: Record<string, IconComponent>;
  fallbackIcon?: IconComponent;
  backLabel?: string;
  emptyCategoriesLabel?: string;
  emptyItemsLabel?: string;
  loadingLabel?: string;
};

type ComposerTriggerPopoverProps = BaseProps &
  ({ directive: DirectiveBehaviorProps; action?: never } | { action: ActionBehaviorProps; directive?: never });

function resolveIcon(
  key: string | undefined,
  iconMap: Record<string, IconComponent> | undefined,
  fallback: IconComponent,
): IconComponent {
  if (key && iconMap?.[key]) return iconMap[key]!;
  return fallback;
}

const Categories: FC<{ iconMap?: Record<string, IconComponent>; fallbackIcon: IconComponent; emptyLabel: string }> = ({
  iconMap,
  fallbackIcon,
  emptyLabel,
}) => (
  <ComposerPrimitive.Unstable_TriggerPopoverCategories>
    {(categories) => (
      <div className="pd-trigpop-list">
        {categories.map((cat) => {
          const Icon = resolveIcon(cat.id, iconMap, fallbackIcon);
          return (
            <ComposerPrimitive.Unstable_TriggerPopoverCategoryItem
              key={cat.id}
              categoryId={cat.id}
              className="pd-trigpop-item"
            >
              <span className="pd-trigpop-name">
                <Icon className="pd-trigpop-icon" />
                {cat.label}
              </span>
            </ComposerPrimitive.Unstable_TriggerPopoverCategoryItem>
          );
        })}
        {categories.length === 0 && <div className="pd-trigpop-empty">{emptyLabel}</div>}
      </div>
    )}
  </ComposerPrimitive.Unstable_TriggerPopoverCategories>
);

const Items: FC<{
  iconMap?: Record<string, IconComponent>;
  fallbackIcon: IconComponent;
  backLabel: string;
  emptyLabel: string;
  loadingLabel: string;
}> = ({ iconMap, fallbackIcon, backLabel, emptyLabel, loadingLabel }) => {
  const { isLoading } = unstable_useTriggerPopoverScopeContext();
  return (
    <ComposerPrimitive.Unstable_TriggerPopoverItems>
      {(items) => (
        <div className="pd-trigpop-list">
          <ComposerPrimitive.Unstable_TriggerPopoverBack className="pd-trigpop-back">
            <IconChevronLeft className="pd-trigpop-icon" />
            {backLabel}
          </ComposerPrimitive.Unstable_TriggerPopoverBack>
          {items.map((item, index) => {
            const iconKey = typeof item.metadata?.icon === "string" ? item.metadata.icon : undefined;
            const Icon = resolveIcon(iconKey, iconMap, fallbackIcon);
            return (
              <ComposerPrimitive.Unstable_TriggerPopoverItem
                key={item.id}
                item={item}
                index={index}
                className="pd-trigpop-item"
              >
                <span className="pd-trigpop-name">
                  <Icon className="pd-trigpop-icon" />
                  {item.label}
                </span>
                {item.description && <span className="pd-trigpop-desc">{item.description}</span>}
              </ComposerPrimitive.Unstable_TriggerPopoverItem>
            );
          })}
          {items.length === 0 && <div className="pd-trigpop-empty">{isLoading ? loadingLabel : emptyLabel}</div>}
        </div>
      )}
    </ComposerPrimitive.Unstable_TriggerPopoverItems>
  );
};

const Impl: FC<ComposerTriggerPopoverProps> = ({
  iconMap,
  fallbackIcon = IconSparkles,
  backLabel = "Back",
  emptyCategoriesLabel = "No items available",
  emptyItemsLabel = "No matching items",
  loadingLabel = "Detecting…",
  directive,
  action,
  ...props
}) => {
  const warned = useRef(false);
  if (import.meta.env.DEV && !warned.current && Boolean(directive) === Boolean(action)) {
    warned.current = true;
    console.warn("[PD] ComposerTriggerPopover needs exactly one of `directive` or `action`.");
  }
  return (
    <ComposerPrimitive.Unstable_TriggerPopover className="pd-trigpop" {...props}>
      {directive ? (
        <ComposerPrimitive.Unstable_TriggerPopover.Directive
          formatter={directive.formatter ?? unstable_defaultDirectiveFormatter}
          onInserted={directive.onInserted}
        />
      ) : action ? (
        <ComposerPrimitive.Unstable_TriggerPopover.Action
          formatter={action.formatter ?? unstable_defaultDirectiveFormatter}
          onExecute={action.onExecute}
          removeOnExecute={action.removeOnExecute}
        />
      ) : null}
      <Categories iconMap={iconMap} fallbackIcon={fallbackIcon} emptyLabel={emptyCategoriesLabel} />
      <Items
        iconMap={iconMap}
        fallbackIcon={fallbackIcon}
        backLabel={backLabel}
        emptyLabel={emptyItemsLabel}
        loadingLabel={loadingLabel}
      />
    </ComposerPrimitive.Unstable_TriggerPopover>
  );
};
Impl.displayName = "ComposerTriggerPopover";

export const ComposerTriggerPopover = memo(Impl) as FC<ComposerTriggerPopoverProps>;
