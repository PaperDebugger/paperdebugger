import { useState } from "react";
import { Modal } from "../../../components/modal";
import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { Button } from "@heroui/react";
import { useSettingStore } from "../../../stores/setting-store";

export const ApiKeySettings = () => {
  const { updateSettings, settings } = useSettingStore();

  const [isShowModal, setIsShowModal] = useState<boolean>(false);

  const handleCustomModelChange = (newModel: CustomModel) => {
    console.log("hi");
    const existingCustomModels = Array.from(settings?.customModels || []).filter((model) => model.id != newModel.id);
    updateSettings({
      customModels: [
        ...existingCustomModels,
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
  onChange: (model: CustomModel) => void;
  model?: never;
};

type ExistingCustomModelSectionProps = {
  isNew: false;
  onChange: (model: CustomModel) => void;
  model: CustomModel;
};

type CustomModelSectionProps = NewCustomModelSectionProps | ExistingCustomModelSectionProps;

const CustomModelSection = ({ isNew, onChange, model }: CustomModelSectionProps) => {
  const [isEditing, setIsEditing] = useState(isNew);
  const [modelName, setModelName] = useState(isNew ? "New Model" : model.name);
  const [baseUrl, setBaseUrl] = useState(model?.baseUrl || "");
  const [slug, setSlug] = useState(model?.slug || "");
  const [apiKey, setApiKey] = useState(model?.apiKey || "");
  const [contextWindow, setContextWindow] = useState<number>(model?.contextWindow || 0);
  const [maxOutput, setMaxOutput] = useState<number>(model?.maxOutput || 0);
  const [inputPrice, setInputPrice] = useState<number>(model?.inputPrice || 0);
  const [outputPrice, setOutputPrice] = useState<number>(model?.outputPrice || 0);

  const baseInputClassName = "hover:cursor-pointer bg-transparent p-1 focus:outline-none";
  const nameInputClassName = `${baseInputClassName} text-sm text-default-900 font-bold`;
  const labelClassName = `${baseInputClassName} text-xs text-default-900 w-auto`;
  const detailInputClassName = `${baseInputClassName} text-xs text-default-400 font-normal flex-1`;

  const handleOnChange = () => {
    // TODO: Input validation
    // TODO: Add loader

    onChange({
      id: isNew ? "" : model.id,
      name: modelName,
      baseUrl: baseUrl,
      slug: slug,
      apiKey: apiKey,
      contextWindow: contextWindow,
      maxOutput: maxOutput,
      inputPrice: inputPrice,
      outputPrice: outputPrice,
    });

    if (isNew) {
      setModelName("New Model");
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
    <div className="flex flex-col w-full">
      {isNew ? (
        <Button size="sm" onPress={handleOnChange}>
          Add (TODO)
        </Button>
      ) : (
        <>
          <Button size="sm" onPress={() => setIsEditing(true)}>
            Edit (TODO)
          </Button>
          <Button
            size="sm"
            onPress={() => {
              setIsEditing(false);
              handleOnChange();
            }}
          >
            Save (TODO)
          </Button>
        </>
      )}

      <input
        className={nameInputClassName}
        value={modelName}
        type="text"
        disabled={!isEditing}
        onChange={(e) => setModelName(e.target.value)}
      ></input>
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
        <label className={labelClassName}>Slug</label>
        <input
          className={detailInputClassName}
          value={slug}
          type="text"
          disabled={!isEditing}
          onChange={(e) => setSlug(e.target.value)}
        />
      </div>

      <div className="flex flex-row">
        <label className={labelClassName}>API Key</label>
        <input
          className={detailInputClassName}
          value={apiKey}
          type="text"
          disabled={!isEditing}
          onChange={(e) => setApiKey(e.target.value)}
        />
      </div>

      <div className="flex flex-row">
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
      </div>
    </div>
  );
};
