import { addToast } from "@heroui/react";

export function successToast(description: string, title: string = "Success") {
  addToast({
    title: title,
    description: description,
    color: "success",
    timeout: 5000,
  });
}

export function warnToast(description: string, title: string = "Warning") {
  addToast({
    title: title,
    description: description,
    color: "warning",
    timeout: 5000,
  });
}

export function errorToast(description: string, title: string = "Error") {
  addToast({
    title: title,
    description: <div className="text-xs text-wrap break-all">{description}</div>,
    color: "danger",
    timeout: 10000,
  });
  console.error(title, description); // eslint-disable-line no-console
}
