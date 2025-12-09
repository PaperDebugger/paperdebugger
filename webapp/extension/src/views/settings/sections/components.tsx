export const SettingsSectionContainer = ({ children }: { children: React.ReactNode }) => {
  return <div className="flex flex-col gap-2 w-full my-2 noselect">{children}</div>;
};

export const SettingsSectionTitle = ({ children }: { children: React.ReactNode }) => {
  return <div className="text-gray-500 text-xs ps-2">{children}</div>;
};
