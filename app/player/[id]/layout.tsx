import Season4ProfileEnhancer from "@/app/components/Season4ProfileEnhancer";

export default function PlayerProfileLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Season4ProfileEnhancer />
    </>
  );
}
