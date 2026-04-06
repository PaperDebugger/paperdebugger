import { Fragment, useState } from "react";
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
  inputPrice: number;
  outputPrice: number;
};

type NewCustomModelSectionProps = {
  isNew: true;
  onChange: (model: CustomModel, isDelete: boolean) => void;
  model?: never;
};

type ExistingCustomModelSectionProps = {
  isNew: false;
  onChange: (model: CustomModel, isDelete: boolean) => void;
  model: CustomModel;
};

type CustomModelSectionProps = NewCustomModelSectionProps | ExistingCustomModelSectionProps;

const CustomModelSection = ({ isNew, onChange, model: customModel }: CustomModelSectionProps) => {
  const id = customModel?.id || "";
  const [isEditing, setIsEditing] = useState(isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [baseUrl, setBaseUrl] = useState(customModel?.baseUrl || "");
  const [slug, setSlug] = useState(customModel?.slug ?? "");
  const [apiKey, setApiKey] = useState(customModel?.apiKey || "");
  const [contextWindow, setContextWindow] = useState<number>(customModel?.contextWindow || 0);
  const [maxOutput, setMaxOutput] = useState<number>(customModel?.maxOutput || 0);
  const [inputPrice, setInputPrice] = useState<number>(customModel?.inputPrice || 0);
  const [outputPrice, setOutputPrice] = useState<number>(customModel?.outputPrice || 0);
  const [modelName, setModelName] = useState(customModel?.name || "");
  const [isModelNameValid, setIsModelNameValid] = useState(true);
  const [isSlugValid, setIsSlugValid] = useState(true);
  const [isBaseUrlValid, setIsBaseUrlValid] = useState(true);
  const [isApiKeyValid, setIsApiKeyValid] = useState(true);

  const borderedInputClassName = "rnd-cancel px-2 py-1 border !border-gray-200 dark:!border-default-200 rounded-md";
  const baseClassName = "bg-transparent p-1 focus:outline-none disabled:opacity-70";
  const modelNameInputClassName = `${baseClassName} ${isEditing || isNew ? borderedInputClassName : ""} text-sm text-default-900 font-medium flex-1 truncate mr-1`;
  const labelClassName = `${baseClassName} text-xs text-default-900 w-auto`;
  const detailInputClassName = `${baseClassName} ${isEditing || isNew ? borderedInputClassName : ""} flex-1 noselect focus:outline-none text-xs text-default-700 placeholder:text-default-400`;
  const errorInputClassName = "!border-red-500 focus:!border-red-500";

  const handleOnChange = async (isDelete: boolean) => {
    if (isSaving) return;

    if (
      modelName.trim().length < 1 ||
      slug.trim().length < 1 ||
      baseUrl.trim().length < 1 ||
      apiKey.trim().length < 1
    ) {
      setIsModelNameValid(modelName.trim().length > 0);
      setIsSlugValid(slug.trim().length > 0);
      setIsBaseUrlValid(baseUrl.trim().length > 0);
      setIsApiKeyValid(apiKey.trim().length > 0);
      return;
    }

    const isSaveAction = !isDelete;
    if (isSaveAction) setIsSaving(true);

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
        },
        isDelete,
      );

      if (isNew) {
        setModelName("");
        setBaseUrl("");
        setSlug("");
        setApiKey("");
        setContextWindow(0);
        setMaxOutput(0);
        setInputPrice(0);
        setOutputPrice(0);
      } else if (isSaveAction) {
        setIsEditing(false);
      }
    } finally {
      if (isSaveAction) setIsSaving(false);
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
          disabled={!isEditing || isSaving}
          onChange={(e) => {
            setIsModelNameValid(true);
            setModelName(e.target.value);
          }}
        ></input>

        {isNew ? (
          <Tooltip content="Add" placement="bottom" className="noselect" delay={500}>
            <button
              onClick={() => handleOnChange(false)}
              disabled={isSaving}
              className="p-1 hover:bg-default-100 rounded disabled:opacity-60"
            >
              <Icon
                icon={isSaving ? "tabler:loader-2" : "tabler:device-floppy"}
                width="16"
                className={isSaving ? "animate-spin" : ""}
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
                disabled={isSaving}
                className="p-1 hover:bg-default-100 rounded disabled:opacity-60"
              >
                <Icon
                  icon={isEditing ? (isSaving ? "tabler:loader-2" : "tabler:device-floppy") : "tabler:pencil"}
                  width="16"
                  className={isEditing && isSaving ? "animate-spin" : ""}
                />
              </button>
            </Tooltip>
            <Tooltip content="Delete" placement="bottom" className="noselect" delay={500}>
              <button
                onClick={() => handleOnChange(true)}
                disabled={isSaving}
                className="p-1 hover:bg-default-100 rounded disabled:opacity-60"
              >
                <Icon icon="tabler:trash" width="16" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      <div className="flex flex-row mt-[4px]">
        <label className={labelClassName}>Slug</label>
        <input
          className={`${detailInputClassName} ${!isSlugValid && errorInputClassName}`}
          value={slug}
          placeholder="e.g., gemini-2.5-flash"
          type="text"
          disabled={!isEditing || isSaving}
          onChange={(e) => {
            setIsSlugValid(true);
            setSlug(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-row mt-[4px]">
        <label className={labelClassName}>Base URL</label>
        <input
          className={`${detailInputClassName} ${!isBaseUrlValid && errorInputClassName}`}
          value={baseUrl}
          placeholder="An OpenAI-compatible endpoint"
          type="text"
          disabled={!isEditing || isSaving}
          onChange={(e) => {
            setIsBaseUrlValid(true);
            setBaseUrl(e.target.value);
          }}
        />
      </div>

      <div className="flex flex-row mt-[4px]">
        <label className={labelClassName}>API Key</label>
        <input
          className={`${detailInputClassName} ${!isApiKeyValid && errorInputClassName}`}
          value={apiKey}
          placeholder="Your API Key"
          type={!isEditing && !isNew ? "password" : "text"}
          disabled={!isEditing || isSaving}
          onChange={(e) => {
            setIsApiKeyValid(true);
            setApiKey(e.target.value);
          }}
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
                disabled={!isEditing || isSaving}
                onChange={(e) => setContextWindow(e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)))}
              />
            </div>

            <div className="flex flex-row">
              <label className={labelClassName}>Max Output</label>
              <input
                className={detailInputClassName}
                value={String(maxOutput)}
                type="number"
                min={0}
                step="1"
                disabled={!isEditing || isSaving}
                onChange={(e) => setMaxOutput(e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)))}
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
                disabled={!isEditing || isSaving}
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
                disabled={!isEditing || isSaving}
                onChange={(e) => setOutputPrice(e.target.value === "" ? 0 : Math.trunc(Number(e.target.value)))}
              />
            </div>
          </div>
        </AccordionItem>
      </Accordion>
    </div>
  );
};
