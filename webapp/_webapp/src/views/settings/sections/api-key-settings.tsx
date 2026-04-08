import { Fragment, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { Modal } from "../../../components/modal";
import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { Accordion, AccordionItem, Button, Tooltip } from "@heroui/react";
import { useSettingStore } from "../../../stores/setting-store";

export const ApiKeySettings = () => {
  const { updateSettings, settings } = useSettingStore();

  const [isShowModal, setIsShowModal] = useState<boolean>(false);

  const handleCustomModelChange = async (newModel: CustomModel, isDelete: boolean) => {
    const otherCustomModels = Array.from(settings?.customModels || []).filter((model) => model.id != newModel.id);

    if (isDelete) {
      await updateSettings({
        customModels: otherCustomModels,
      });
    } else {
      const hasDuplicate = otherCustomModels.some(
        (model) =>
          model.name.trim().toLowerCase() === newModel.name.trim().toLowerCase() &&
          model.slug.trim().toLowerCase() === newModel.slug.trim().toLowerCase(),
      );

      if (hasDuplicate) {
        throw new Error("A model with the same name and slug already exists.");
      }

      await updateSettings({
        customModels: [
          ...otherCustomModels,
          {
            id: newModel.id,
            name: newModel.name,
            baseUrl: newModel.baseUrl,
            slug: newModel.slug,
            apiKey: newModel.apiKey,
            contextWindow: newModel.contextWindow,
            maxOutput: newModel.maxOutput,
            inputPrice: newModel.inputPrice,
            outputPrice: newModel.outputPrice,
            temperature: newModel.temperature,
            parallelToolCalls: newModel.parallelToolCalls,
            store: newModel.store,
          },
        ],
      });
    }
  };

  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>Bring Your Own Key (BYOK)</SettingsSectionTitle>
      <Button size="sm" variant="bordered" onPress={() => setIsShowModal((i) => !i)} className="shrink-0">
        Edit
      </Button>
      <Modal
        isOpen={isShowModal}
        onOpenChange={(isOpen) => setIsShowModal(isOpen)}
        content={
          <div className="flex flex-col h-[80vh] gap-4 p-4 overflow-y-auto">
            <CustomModelSection key={"new_custom_model"} isNew onChange={handleCustomModelChange} />
            {Array.from(settings?.customModels || []).map((m) => (
              <Fragment key={m.id}>
                <hr></hr>
                <CustomModelSection
                  isNew={false}
                  onChange={handleCustomModelChange}
                  model={{
                    id: m.id,
                    name: m.name,
                    baseUrl: m.baseUrl,
                    slug: m.slug,
                    apiKey: m.apiKey,
                    contextWindow: m.contextWindow,
                    maxOutput: m.maxOutput,
                    inputPrice: m.inputPrice,
                    outputPrice: m.outputPrice,
                    temperature: m.temperature,
                    parallelToolCalls: m.parallelToolCalls,
                    store: m.store,
                  }}
                />
              </Fragment>
            ))}
          </div>
        }
      />
    </SettingsSectionContainer>
  );
};

type CustomModel = {
  id: string;
  name: string;
  baseUrl: string;
  slug: string;
  apiKey: string;
  contextWindow: number;
  maxOutput: number;
  temperature: number;
  parallelToolCalls: boolean;
  store: boolean;
  inputPrice: number;
  outputPrice: number;
};

type NewCustomModelSectionProps = {
  isNew: true;
  onChange: (model: CustomModel, isDelete: boolean) => Promise<void>;
  model?: never;
};

type ExistingCustomModelSectionProps = {
  isNew: false;
  onChange: (model: CustomModel, isDelete: boolean) => Promise<void>;
  model: CustomModel;
};

type CustomModelSectionProps = NewCustomModelSectionProps | ExistingCustomModelSectionProps;

const CustomModelSection = ({ isNew, onChange, model: customModel }: CustomModelSectionProps) => {
  const id = customModel?.id || "";
  const [isEditing, setIsEditing] = useState(isNew);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingAction, setProcessingAction] = useState<"save" | "delete" | null>(null);
  const [baseUrl, setBaseUrl] = useState(customModel?.baseUrl || "");
  const [slug, setSlug] = useState(customModel?.slug ?? "");
  const [apiKey, setApiKey] = useState(customModel?.apiKey || "");
  const [contextWindow, setContextWindow] = useState<number>(customModel?.contextWindow ?? 0);
  const [maxOutput, setMaxOutput] = useState<number>(customModel?.maxOutput ?? 4000);
  const [temperature, setTemperature] = useState<number>(customModel?.temperature ?? 0.7);
  const [parallelToolCalls, setParallelToolCalls] = useState<boolean>(customModel?.parallelToolCalls ?? true);
  const [store, setStore] = useState<boolean>(customModel?.store ?? false);
  const [inputPrice, setInputPrice] = useState<number>(customModel?.inputPrice ?? 0);
  const [outputPrice, setOutputPrice] = useState<number>(customModel?.outputPrice ?? 0);
  const [modelName, setModelName] = useState(customModel?.name || "");
  const [isModelNameValid, setIsModelNameValid] = useState(true);
  const [isSlugValid, setIsSlugValid] = useState(true);
  const [isBaseUrlValid, setIsBaseUrlValid] = useState(true);
  const [isApiKeyValid, setIsApiKeyValid] = useState(true);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const borderedInputClassName = "rnd-cancel px-2 py-1 border !border-gray-200 dark:!border-default-200 rounded-md";
  const baseClassName = "bg-transparent p-1 focus:outline-none disabled:opacity-70";
  const modelNameInputClassName = `${baseClassName} ${isEditing || isNew ? borderedInputClassName : ""} text-sm text-default-900 font-medium flex-1 truncate mr-1`;
  const labelClassName = `${baseClassName} text-xs text-default-900 w-auto`;
  const detailInputClassName = `${baseClassName} ${isEditing || isNew ? borderedInputClassName : ""} flex-1 noselect focus:outline-none text-xs text-default-700 placeholder:text-default-400`;
  const errorInputClassName = "!border-red-500 focus:!border-red-500";

  useEffect(() => {
    if (isNew || !customModel) return;
    if (isEditing) return;

    setModelName(customModel.name || "");
    setBaseUrl(customModel.baseUrl || "");
    setSlug(customModel.slug || "");
    setApiKey(customModel.apiKey || "");
    setContextWindow(customModel.contextWindow ?? 0);
    setMaxOutput(customModel.maxOutput ?? 4000);
    setInputPrice(customModel.inputPrice ?? 0);
    setOutputPrice(customModel.outputPrice ?? 0);
    setTemperature(customModel.temperature ?? 0.7);
    setParallelToolCalls(customModel.parallelToolCalls ?? true);
    setStore(customModel.store ?? false);
  }, [isNew, isEditing, customModel]);

  const handleOnChange = async (isDelete: boolean) => {
    if (isProcessing) return;

    const isSaveAction = !isDelete;

    if (isSaveAction) {
      // Input validation
      const missingFields: string[] = [];
      if (modelName.trim().length < 1) missingFields.push("Model Name");
      if (slug.trim().length < 1) missingFields.push("Slug");
      if (baseUrl.trim().length < 1) missingFields.push("Base URL");
      if (apiKey.trim().length < 1) missingFields.push("API Key");

      if (missingFields.length > 0) {
        setIsModelNameValid(modelName.trim().length > 0);
        setIsSlugValid(slug.trim().length > 0);
        setIsBaseUrlValid(baseUrl.trim().length > 0);
        setIsApiKeyValid(apiKey.trim().length > 0);
        setSubmitError(`Please fill in required fields: ${missingFields.join(", ")}.`);
        return;
      }

      if (maxOutput < 1) {
        setSubmitError("Max Output cannot be less than 1.");
        return;
      }
    }

    setSubmitError(null);
    setIsProcessing(true);
    setProcessingAction(isDelete ? "delete" : "save");

    try {
      await onChange(
        {
          id: id,
          name: modelName.trim(),
          baseUrl: baseUrl.trim(),
          slug: slug.trim(),
          apiKey: apiKey.trim(),
          contextWindow: contextWindow,
          maxOutput: maxOutput,
          inputPrice: inputPrice,
          outputPrice: outputPrice,
          temperature: temperature,
          parallelToolCalls: parallelToolCalls,
          store: store,
        },
        isDelete,
      );

      if (isNew) {
        setModelName("");
        setBaseUrl("");
        setSlug("");
        setApiKey("");
        setContextWindow(0);
        setMaxOutput(4000);
        setInputPrice(0);
        setOutputPrice(0);
        setTemperature(0.7);
        setParallelToolCalls(true);
        setStore(false);
      } else if (isSaveAction) {
        setIsEditing(false);
      }
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Failed to save new model.");
    } finally {
      setIsProcessing(false);
      setProcessingAction(null);
    }
  };

  return (
    <div className="flex flex-col w-full pl-1">
      <div className="flex flex-row justify-between">
        <input
          className={`${modelNameInputClassName} ${!isModelNameValid && errorInputClassName}`}
          value={modelName}
          placeholder="My Model"
          type="text"
          disabled={!isEditing || isProcessing}
          onChange={(e) => {
            setIsModelNameValid(true);
            setSubmitError(null);
            setModelName(e.target.value);
          }}
        ></input>

        {isNew ? (
          <Tooltip content="Add" placement="bottom" className="noselect" delay={500}>
            <button
              onClick={() => handleOnChange(false)}
              disabled={isProcessing}
              className="p-1 hover:bg-default-100 rounded disabled:opacity-60"
            >
              <Icon
                icon={isProcessing && processingAction === "save" ? "tabler:loader-2" : "tabler:device-floppy"}
                width="16"
                className={isProcessing && processingAction === "save" ? "animate-spin" : ""}
              />
            </button>
          </Tooltip>
        ) : (
          <div>
            <Tooltip content="Edit" placement="bottom" className="noselect" delay={500}>
              <button
                onClick={() => {
                  if (isEditing) {
                    handleOnChange(false);
                  } else {
                    setIsEditing(true);
                  }
                }}
                disabled={isProcessing}
                className="p-1 hover:bg-default-100 rounded disabled:opacity-60"
              >
                <Icon
                  icon={
                    isEditing
                      ? isProcessing && processingAction === "save"
                        ? "tabler:loader-2"
                        : "tabler:device-floppy"
                      : "tabler:pencil"
                  }
                  width="16"
                  className={isEditing && isProcessing && processingAction === "save" ? "animate-spin" : ""}
                />
              </button>
            </Tooltip>
            <Tooltip content="Delete" placement="bottom" className="noselect" delay={500}>
              <button
                onClick={() => handleOnChange(true)}
                disabled={isProcessing}
                className="p-1 hover:bg-default-100 rounded disabled:opacity-60"
              >
                <Icon
                  icon={isProcessing && processingAction === "delete" ? "tabler:loader-2" : "tabler:trash"}
                  width="16"
                  className={isProcessing && processingAction === "delete" ? "animate-spin" : ""}
                />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      <div className="flex flex-row mt-[4px]">
        <Tooltip
          content={
            <div>
              Slugs are unique, short identifiers for AI models in API calls.
              <br />
              <strong>Common examples:</strong>
              <br />
              - gemini-2.5-flash
              <br />
              - MiniMax-M2.5
              <br />
              - glm-4.7
              <br />
              - gpt-5.1
              <br />
              - openai/gpt-5.1 (OpenRouter)
              <br />
            </div>
          }
          placement="bottom"
          delay={100}
        >
          <label className={`${labelClassName} underline decoration-dotted underline-offset-2`}>Slug</label>
        </Tooltip>
        <input
          className={`${detailInputClassName} ${!isSlugValid && errorInputClassName}`}
          value={slug}
          placeholder="e.g., gemini-2.5-flash"
          type="text"
          disabled={!isEditing || isProcessing}
          onChange={(e) => {
            setIsSlugValid(true);
            setSubmitError(null);
            setSlug(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-row mt-[4px]">
        <Tooltip
          content={
            <div>
              Only OpenAI-compatible endpoints are supported currently.
              <br />
              <strong>Common examples:</strong>
              <br />
              - https://api.anthropic.com/v1/
              <br />
              - https://api.openai.com/v1
              <br />
              - https://generativelanguage.googleapis.com/v1beta/openai/
              <br />
            </div>
          }
          placement="bottom"
          delay={100}
        >
          <label className={`${labelClassName} underline decoration-dotted underline-offset-2`}>Base URL</label>
        </Tooltip>
        <input
          className={`${detailInputClassName} ${!isBaseUrlValid && errorInputClassName}`}
          value={baseUrl}
          placeholder="An OpenAI-compatible endpoint"
          type="text"
          disabled={!isEditing || isProcessing}
          onChange={(e) => {
            setIsBaseUrlValid(true);
            setSubmitError(null);
            setBaseUrl(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-row mt-[4px]">
        <label className={`${labelClassName}`}>API Key</label>
        <input
          className={`${detailInputClassName} ${!isApiKeyValid && errorInputClassName}`}
          value={apiKey}
          placeholder="Your API Key"
          type={!isEditing && !isNew ? "password" : "text"}
          disabled={!isEditing || isProcessing}
          onChange={(e) => {
            setIsApiKeyValid(true);
            setSubmitError(null);
            setApiKey(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-row mt-[4px]">
        <Tooltip
          content="An upper bound for the number of tokens that can be generated for a completion."
          placement="bottom"
          delay={100}
        >
          <label className={`${labelClassName} underline decoration-dotted underline-offset-2`}>Max Output</label>
        </Tooltip>
        <input
          className={detailInputClassName}
          value={String(maxOutput)}
          type="number"
          min={0}
          step="1"
          disabled={!isEditing || isProcessing}
          onChange={(e) => setMaxOutput(e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)))}
        />
      </div>

      <div className="flex flex-row mt-[4px]">
        <label className={`${labelClassName}`}>Temperature</label>
        <input
          className={detailInputClassName}
          value={String(temperature)}
          type="number"
          min={0}
          max={2}
          step="0.1"
          disabled={!isEditing || isProcessing}
          onChange={(e) => setTemperature(e.target.value === "" ? 0 : Number(e.target.value))}
        />
      </div>

      <div className="flex flex-row mt-[4px]">
        <label className={`${labelClassName}`}>Parallel Tool Calls</label>
        <input
          id={`parallel-${id}`}
          className="mr-2"
          type="checkbox"
          checked={parallelToolCalls}
          disabled={!isEditing || isProcessing}
          onChange={(e) => setParallelToolCalls(e.target.checked)}
        />
      </div>

      <div className="flex flex-row mt-[4px]">
        <label className={`${labelClassName}`}>Store</label>
        <input
          id={`store-${id}`}
          className="mr-2"
          type="checkbox"
          checked={store}
          disabled={!isEditing || isProcessing}
          onChange={(e) => setStore(e.target.checked)}
        />
      </div>

      <Accordion className="mt-2 px-0" variant="light" selectionMode="multiple">
        <AccordionItem
          key="optional-fields"
          aria-label="More"
          title={<span className="text-xs text-default-900">{isNew ? "Optional Fields" : "More"}</span>}
          classNames={{
            trigger: "px-1 py-0 min-h-0",
            content: "pt-1 pb-1",
          }}
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-row">
              <label className={labelClassName}>Context Window</label>
              <input
                className={detailInputClassName}
                value={String(contextWindow)}
                type="number"
                min={0}
                step="1"
                disabled={!isEditing || isProcessing}
                onChange={(e) => setContextWindow(e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)))}
              />
            </div>

            <div className="flex flex-row">
              <label className={labelClassName}>Input Price</label>
              <input
                className={detailInputClassName}
                value={String(inputPrice)}
                type="number"
                min={0}
                step="1"
                disabled={!isEditing || isProcessing}
                onChange={(e) => setInputPrice(e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)))}
              />
            </div>

            <div className="flex flex-row">
              <label className={labelClassName}>Output Price</label>
              <input
                className={detailInputClassName}
                value={String(outputPrice)}
                type="number"
                min={0}
                step="1"
                pattern="[0-9]*"
                disabled={!isEditing || isProcessing}
                onChange={(e) => setOutputPrice(e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)))}
              />
            </div>
          </div>
        </AccordionItem>
      </Accordion>

      {submitError && <div className="mt-2 px-1 text-xs text-red-500">{submitError}</div>}
    </div>
  );
};
