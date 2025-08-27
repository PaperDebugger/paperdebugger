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
    description: description,
    color: "danger",
    timeout: 10000,
  });
  console.trace(); // eslint-disable-line no-console
}
