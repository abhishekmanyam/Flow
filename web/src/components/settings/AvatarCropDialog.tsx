import { useState, useCallback } from "react";
import type { CSSProperties } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
import { getCroppedImage } from "@/lib/crop-image";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent, LayoutFooter } from "@astryxdesign/core/Layout";
import { HStack } from "@astryxdesign/core/HStack";
import { VStack } from "@astryxdesign/core/VStack";
import { Text } from "@astryxdesign/core/Text";
import { Button } from "@astryxdesign/core/Button";
import { Slider } from "@astryxdesign/core/Slider";

// Scoped exception (DESIGN_SPEC rule 1): react-easy-crop absolutely-positions
// its own container and requires a sized, position:relative ancestor. No
// Astryx layout prop exposes `position`, and StyleX isn't compiled in this
// build, so this ancestor's positioning is set via a geometry-only inline
// `style` — no visual CSS (color/radius/etc.) here, only the structural
// position/size third-party lib requirement.
const cropAreaStyle: CSSProperties = { position: "relative" };

interface AvatarCropDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  imageSrc: string;
  onCropComplete: (blob: Blob) => void;
}

export function AvatarCropDialog({
  open,
  onOpenChange,
  imageSrc,
  onCropComplete,
}: AvatarCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);
  const [saving, setSaving] = useState(false);

  const onCropChange = useCallback(
    (_croppedArea: Area, croppedAreaPixels: Area) => {
      setCroppedArea(croppedAreaPixels);
    },
    []
  );

  const handleSave = async () => {
    if (!croppedArea) return;
    setSaving(true);
    try {
      const blob = await getCroppedImage(imageSrc, croppedArea);
      onCropComplete(blob);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog isOpen={open} onOpenChange={onOpenChange} purpose="form" width={420}>
      <Layout
        header={<DialogHeader title="Crop avatar" onOpenChange={onOpenChange} />}
        content={
          <LayoutContent>
            <VStack gap={4}>
              <VStack height={256} width="100%" style={cropAreaStyle}>
                <Cropper
                  image={imageSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={onCropChange}
                />
              </VStack>
              <HStack gap={3} align="center">
                <Text type="supporting" color="secondary">
                  Zoom
                </Text>
                <Slider
                  label="Zoom"
                  isLabelHidden
                  min={1}
                  max={3}
                  step={0.1}
                  value={zoom}
                  onChange={(v: number) => setZoom(v)}
                />
              </HStack>
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} justify="end">
              <Button label="Cancel" variant="secondary" onClick={() => onOpenChange(false)} />
              <Button label="Save" variant="primary" onClick={handleSave} isLoading={saving} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}
