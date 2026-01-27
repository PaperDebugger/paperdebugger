import { useState } from "react";
import { Modal } from "../../../components/modal";
import { SettingsSectionContainer, SettingsSectionTitle } from "./components";
import { Button } from "@heroui/react";

export const ApiKeySettings = () => {
  const [isShowApiKeyModal, setIsShowApiKeyModal] = useState<boolean>(false);

  return (
    <SettingsSectionContainer>
      <SettingsSectionTitle>Bring Your Own Key (BYOK)</SettingsSectionTitle>
      <Button size="sm" variant="bordered" onPress={() => setIsShowApiKeyModal((i) => !i)} className="shrink-0">
        Edit
      </Button>
      <Modal
        isOpen={isShowApiKeyModal}
        onOpenChange={(isOpen) => setIsShowApiKeyModal(isOpen)}
        content={
          <div className="flex flex-col p-4">
            <Button size="md" variant="bordered">
              Add custom model
            </Button>

            <CustomModelSection
              model={{
                name: "Custom 1",
                baseUrl: "https://www.example.com",
                slug: "openai/gpt-4.1",
                apiKey: "sk-123456789-abcdefg",
                contextWindow: 128000,
                inputPrice: 200,
                outputPrice: 200,
              }}
            />

            <CustomModelSection
              model={{
                name: "Custom 2",
                baseUrl: "https://www.example2.com",
                slug: "openai/gpt-5.2",
                apiKey: "sk-123456789-abcdefg",
                contextWindow: 256000,
                inputPrice: 200,
                outputPrice: 200,
              }}
            />
          </div>
        }
      />
    </SettingsSectionContainer>
  );
};

type CustomModelSectionProps = {
  model: {
    name: string;
    baseUrl: string;
    slug: string;
    apiKey: string;
    contextWindow: number;
    inputPrice: number;
    outputPrice: number;
  };
};

const CustomModelSection = ({ model }: CustomModelSectionProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [modelName, setModelName] = useState(model.name);
  const [baseUrl, setBaseUrl] = useState(model.baseUrl);
  const [slug, setSlug] = useState(model.slug);
  const [apiKey, setApiKey] = useState(model.apiKey);
  const [contextWindow, setContextWindow] = useState<number>(model.contextWindow);
  const [inputPrice, setInputPrice] = useState<number>(model.inputPrice);
  const [outputPrice, setOutputPrice] = useState<number>(model.outputPrice);

  const baseInputClassName = "hover:cursor-pointer bg-transparent p-1 focus:outline-none";
  const nameInputClassName = `${baseInputClassName} text-sm text-default-900 font-bold`;
  const labelClassName = `${baseInputClassName} text-xs text-default-900 w-auto`;
  const detailInputClassName = `${baseInputClassName} text-xs text-default-400 font-normal flex-1`;

  return (
    <div className="flex flex-col w-full mt-5">
      <Button size="sm" onPress={() => setIsEditing(true)}>
        Edit (TODO)
      </Button>
      <Button size="sm" onPress={() => setIsEditing(false)}>
        Save (TODO)
      </Button>
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
          value={contextWindow}
          type="number"
          disabled={!isEditing}
          onChange={(e) => setContextWindow(e.target.valueAsNumber)}
        />
      </div>

      <div className="flex flex-row">
        <label className={labelClassName}>Input Price</label>
        <input
          className={detailInputClassName}
          value={inputPrice}
          type="number"
          disabled={!isEditing}
          onChange={(e) => setInputPrice(e.target.valueAsNumber)}
        />
      </div>

      <div className="flex flex-row">
        <label className={labelClassName}>Output Price</label>
        <input
          className={detailInputClassName}
          value={outputPrice}
          type="number"
          disabled={!isEditing}
          onChange={(e) => setOutputPrice(e.target.valueAsNumber)}
        />
      </div>
    </div>
  );
};
