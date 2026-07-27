import { GuestDeliveryGallery } from '@/components/guest-delivery-gallery';

type Props = { params: Promise<{ token: string }> };
export default async function DeliveryGalleryPage({ params }: Props): Promise<React.ReactElement> {
  const { token } = await params;
  return <GuestDeliveryGallery token={token} />;
}
