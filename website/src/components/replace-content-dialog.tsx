import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { ReactNode } from 'react';

type ReplaceContentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  onCancel: () => void;
  description?: ReactNode;
};

export function ReplaceContentDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  description = (
    <>
      Replacing the audio or cue file will clear the uploaded cue sheet, track list, and overall details. This
      action cannot be undone.
    </>
  ),
}: ReplaceContentDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Replace current files?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Keep current content</AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 font-semibold text-white hover:bg-red-800"
            onClick={onConfirm}
          >
            Replace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
