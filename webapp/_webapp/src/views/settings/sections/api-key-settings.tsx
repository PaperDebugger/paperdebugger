import { useState } from "react";
import { Icon } from "@iconify/react";
import { Modal } from "../../../components/modal";
import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { Button, Tooltip } from "@heroui/react";
import { useSettingStore } from "../../../stores/setting-store";

export const ApiKeySettings = () => {
  const { updateSettings, settings } = useSettingStore();

  const [isShowModal, setIsShowModal] = useState<boolean>(false);

  const handleCustomModelChange = (newModel: CustomModel, isDelete: boolean) => {
    const otherCustomModels = Array.from(settings?.customModels || []).filter((model) => model.id != newModel.id);

    if (isDelete) {
      updateSettings({
        customModels: otherCustomModels,
      });
    } else {
      updateSettings({
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
            <CustomModelSection key={""} isNew onChange={handleCustomModelChange} />
            {Array.from(settings?.customModels || [])
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((m) => (
                <>
                  <hr></hr>
                  <CustomModelSection
                    isNew={false}
                    onChange={handleCustomModelChange}
                    key={m.id}
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
                </>
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
  const [baseUrl, setBaseUrl] = useState(customModel?.baseUrl || "");
  const [slug, setSlug] = useState(customModel?.slug ?? "");
  const [apiKey, setApiKey] = useState(customModel?.apiKey || "");
  const [contextWindow, setContextWindow] = useState<number>(customModel?.contextWindow || 0);
  const [maxOutput, setMaxOutput] = useState<number>(customModel?.maxOutput || 0);
  const [inputPrice, setInputPrice] = useState<number>(customModel?.inputPrice || 0);
  const [outputPrice, setOutputPrice] = useState<number>(customModel?.outputPrice || 0);
  const [modelName, setModelName] = useState(customModel?.name || "");

  const baseClassName = "bg-transparent p-1 focus:outline-none disabled:opacity-70 disabled:cursor-not-allowed";
  const modelNameInputClassName = `${baseClassName} text-sm text-default-900 font-medium flex-1 truncate rnd-cancel px-2 py-1 border !border-gray-200 dark:!border-default-200 rounded-md mr-1`;
  const labelClassName = `${baseClassName} text-xs text-default-900 w-auto`;
  const detailInputClassName = `${baseClassName} flex-1 noselect focus:outline-none rnd-cancel px-2 py-1 border !border-gray-200 dark:!border-default-200 rounded-md 
    text-xs text-default-700 placeholder:text-default-400`;

  const handleOnChange = (isDelete: boolean) => {
    if (
      modelName.trim().length < 1 ||
      slug.trim().length < 1 ||
      baseUrl.trim().length < 1 ||
      apiKey.trim().length < 1
    ) {
      return;
    }

    onChange(
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
    }
  };

  return (
    <div className="flex flex-col w-full pl-1">
      <div className="flex flex-row justify-between">
        <input
          className={modelNameInputClassName}
          value={modelName}
          placeholder="My Model"
          type="text"
          disabled={!isEditing}
          onChange={(e) => setModelName(e.target.value)}
        ></input>

        {isNew ? (
          <Tooltip content="Add" placement="bottom" className="noselect" delay={500}>
            <button onClick={() => handleOnChange(false)} className="p-1 hover:bg-default-100 rounded">
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

      <div className="flex flex-row mt-[4px]">
        <label className={labelClassName}>Slug</label>
        <input
          className={detailInputClassName}
          value={slug}
          placeholder="e.g., gemini-2.5-flash"
          type="text"
          disabled={!isEditing}
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>

      <div className="flex flex-row mt-[4px]">
        <label className={labelClassName}>Base URL</label>
        <input
          className={detailInputClassName}
          value={baseUrl}
          placeholder="An OpenAI-compatible endpoint"
          type="text"
          disabled={!isEditing}
          onChange={(e) => setBaseUrl(e.target.value)}
        />
      </div>

      <div className="flex flex-row mt-[4px]">
        <label className={labelClassName}>API Key</label>
        <input
          className={detailInputClassName}
          value={apiKey}
          placeholder="Your API Key"
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
  );
};
