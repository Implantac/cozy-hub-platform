import * as React from "react";
import { useFormContext, type FieldPath, type FieldValues } from "react-hook-form";

/**
 * The context + hook behind `<FormField>`/`<FormItem>`.
 *
 * Split out of `form.tsx` because that module also exports components, and a
 * module mixing them cannot hot-reload: every edit to a form control rebuilt the
 * page and reset the values being typed — during development, in the one place
 * where losing state is most annoying.
 *
 * Consumers keep importing `useFormField` from `@/components/ui/form`; it is
 * re-exported there.
 */
type FormFieldContextValue<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> = {
  name: TName;
};

const FormFieldContext = React.createContext<FormFieldContextValue | null>(null);

const useFormField = () => {
  const fieldContext = React.useContext(FormFieldContext);
  const itemContext = React.useContext(FormItemContext);
  const { getFieldState, formState } = useFormContext();

  if (!fieldContext) {
    throw new Error("useFormField should be used within <FormField>");
  }

  if (!itemContext) {
    throw new Error("useFormField should be used within <FormItem>");
  }

  const fieldState = getFieldState(fieldContext.name, formState);

  const { id } = itemContext;

  return {
    id,
    name: fieldContext.name,
    formItemId: `${id}-form-item`,
    formDescriptionId: `${id}-form-item-description`,
    formMessageId: `${id}-form-item-message`,
    ...fieldState,
  };
};

type FormItemContextValue = {
  id: string;
};

const FormItemContext = React.createContext<FormItemContextValue | null>(null);
export { FormFieldContext, FormItemContext, useFormField };
export type { FormFieldContextValue, FormItemContextValue };
