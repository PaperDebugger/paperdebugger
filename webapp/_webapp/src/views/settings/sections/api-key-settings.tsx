import { useRef, useState, useEffect } from "react";
import { Icon } from "@iconify/react";
import { Modal } from "../../../components/modal";
import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { Button, Tooltip } from "@heroui/react";
import { useSettingStore } from "../../../stores/setting-store";
import { useLanguageModels } from "../../../hooks/useLanguageModels";

export const ApiKeySettings = () => {
  const { updateSettings, settings } = useSettingStore();

  const [isShowModal, setIsShowModal] = useState<boolean>(false);

  const handleCustomModelChange = (newModel: CustomModel, isDelete: boolean) => {
    const otherCustomModels = Array.from(settings?.customModels || []).filter((model) => model.slug != newModel.slug);

    if (isDelete) {
      updateSettings({
        customModels: otherCustomModels,
      });
    } else {
      updateSettings({
        customModels: [
          ...otherCustomModels,
          {
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
            <CustomModelSection key={"newModel"} isNew onChange={handleCustomModelChange} />
            {Array.from(settings?.customModels || [])
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((m) => (
                <CustomModelSection
                  isNew={false}
                  onChange={handleCustomModelChange}
                  key={m.slug}
                  model={{
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
              ))}
          </div>
        }
      />
    </SettingsSectionContainer>
  );
};

type CustomModel = {
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
  const { models } = useLanguageModels();
  const { settings } = useSettingStore();

  var availableModels = models.filter((m) => !Array.from(settings?.customModels || []).some((cm) => cm.slug == m.slug));
  var firstAvailable = availableModels[0] ?? { slug: "", name: "" };

  const [isEditing, setIsEditing] = useState(isNew);
  const [baseUrl, setBaseUrl] = useState(customModel?.baseUrl || "");
  const [slug, setSlug] = useState(customModel?.slug ?? firstAvailable.slug);
  const [apiKey, setApiKey] = useState(customModel?.apiKey || "");
  const [contextWindow, setContextWindow] = useState<number>(customModel?.contextWindow || 0);
  const [maxOutput, setMaxOutput] = useState<number>(customModel?.maxOutput || 0);
  const [inputPrice, setInputPrice] = useState<number>(customModel?.inputPrice || 0);
  const [outputPrice, setOutputPrice] = useState<number>(customModel?.outputPrice || 0);
  const [modelName, setModelName] = useState(isNew ? firstAvailable.name : customModel?.name || "");
  const isModelNameEdited = useRef(false);

  useEffect(() => {
    if (!isNew) return;
    const firstAvailable = availableModels[0] ?? { slug: "", name: "" };
    if (!isModelNameEdited.current) {
      setModelName(firstAvailable.name);
    }
    setSlug(firstAvailable.slug);
  }, [models?.length, settings?.customModels?.length, isNew]);

  const baseInputClassName = "hover:cursor-pointer bg-transparent p-1 focus:outline-none";
  const nameInputClassName = `${baseInputClassName} text-sm text-default-900 font-medium flex-1 truncate`;
  const labelClassName = `${baseInputClassName} text-xs text-default-900 w-auto`;
  const detailInputClassName = `${baseInputClassName} text-xs text-default-400 font-normal flex-1`;

  const handleOnChange = (isDelete: boolean) => {
    // TODO: Input validation
    // TODO: Add loader

    onChange(
      {
        name: modelName,
        baseUrl: baseUrl,
        slug: slug,
        apiKey: apiKey,
        contextWindow: contextWindow,
        maxOutput: maxOutput,
        inputPrice: inputPrice,
        outputPrice: outputPrice,
      },
      isDelete,
    );

    if (isNew) {
      availableModels = availableModels.filter((m) => m.slug != slug);
      const next = availableModels[0] ?? { slug: "", name: "" };
      setModelName(next.name);
      setBaseUrl("");
      setSlug(next.slug);
      setApiKey("");
      setContextWindow(0);
      setMaxOutput(0);
      setInputPrice(0);
      setOutputPrice(0);
    }
  };

  return (
    <div className="flex flex-col w-full pl-1">
      <div className="flex flex-row justify-between">
        <input
          className={nameInputClassName}
          value={modelName}
          type="text"
          disabled={!isEditing}
          onChange={(e) => {
            isModelNameEdited.current = true;
            setModelName(e.target.value);
          }}
        ></input>

        {isNew ? (
          <Tooltip content="Add" placement="bottom" className="noselect" delay={500}>
            <button
              onClick={() => {
                if (availableModels.length > 0) {
                  handleOnChange(false);
                }
              }}
              className="p-1 hover:bg-default-100 rounded"
              disabled={availableModels.length === 0}
            >
              <Icon icon="tabler:device-floppy" width="16" />
            </button>
          </Tooltip>
        ) : (
          <div>
            <Tooltip content="Edit" placement="bottom" className="noselect" delay={500}>
              <button
                onClick={() => {
                  if (isEditing) {
                    handleOnChange(false);
                  }
                  setIsEditing((i) => !i);
                }}
                className="p-1 hover:bg-default-100 rounded"
              >
                <Icon icon={isEditing ? "tabler:device-floppy" : "tabler:pencil"} width="16" />
              </button>
            </Tooltip>
            <Tooltip content="Delete" placement="bottom" className="noselect" delay={500}>
              <button onClick={() => handleOnChange(true)} className="p-1 hover:bg-default-100 rounded">
                <Icon icon="tabler:trash" width="16" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      <div className="pr-1">
        <div className="flex flex-row">
          <label className={labelClassName}>Slug</label>
          <select
            className={detailInputClassName}
            disabled={!isEditing}
            onChange={(e) => {
              setSlug(e.target.value);
              if (!isModelNameEdited.current && isNew) {
                // Custom name not yet defined, default to the selected model's name
                const m = availableModels.find((mo) => mo.slug == e.target.value);
                if (m) setModelName(m.name);
              }
            }}
            value={slug}
          >
            {isNew ? (
              availableModels.length > 0 ? (
                availableModels.map((m) => (
                  <option key={m.slug} value={m.slug}>
                    {m.slug}
                  </option>
                ))
              ) : (
                <option disabled value="">
                  No available models
                </option>
              )
            ) : (
              <option>{slug}</option>
            )}
          </select>
        </div>

        <div className="flex flex-row">
          <label className={labelClassName}>Base URL</label>
          <input
            className={detailInputClassName}
            value={baseUrl}
            type="text"
            disabled={!isEditing}
            onChange={(e) => setBaseUrl(e.target.value)}
          />
        </div>

        <div className="flex flex-row">
          <label className={labelClassName}>API Key</label>
          <input
            className={detailInputClassName}
            value={apiKey}
            type={!isEditing && !isNew ? "password" : "text"}
            disabled={!isEditing}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </div>

        {/* <div className="flex flex-row">
        <label className={labelClassName}>Context Window</label>
        <input
          className={detailInputClassName}
          value={String(contextWindow)}
          type="text"
          disabled={!isEditing}
          onChange={(e) => setContextWindow(e.target.valueAsNumber)}
        />
      </div>

      <div className="flex flex-row">
        <label className={labelClassName}>Max Output</label>
        <input
          className={detailInputClassName}
          value={String(maxOutput)}
          type="text"
          disabled={!isEditing}
          onChange={(e) => setMaxOutput(e.target.valueAsNumber)}
        />
      </div>

      <div className="flex flex-row">
        <label className={labelClassName}>Input Price</label>
        <input
          className={detailInputClassName}
          value={String(inputPrice)}
          type="text"
          disabled={!isEditing}
          onChange={(e) => setInputPrice(e.target.valueAsNumber)}
        />
      </div>

      <div className="flex flex-row">
        <label className={labelClassName}>Output Price</label>
        <input
          className={detailInputClassName}
          value={String(outputPrice)}
          type="text"
          disabled={!isEditing}
          onChange={(e) => setOutputPrice(e.target.valueAsNumber)}
        />
      </div> */}
      </div>
    </div>
  );
};
