/**
 * Le vocabulaire d'icônes du produit.
 *
 * Les écrans importent d'ici, jamais de `lucide-react` directement : une
 * notion garde ainsi la même icône partout — le billet est toujours le
 * même billet, de la carte d'événement au scanner du portier. Changer
 * d'icône, ou de librairie, se fait alors en un seul endroit.
 *
 * Les emojis qui tenaient ce rôle sont abandonnés : leur dessin change
 * d'un téléphone à l'autre, ils ne suivent ni la couleur du texte ni
 * l'épaisseur du trait, et ils sont lus à voix haute par les lecteurs
 * d'écran là où une icône décorative devrait rester muette.
 */
export {
  House as HomeIcon,
  Compass as ExploreIcon,
  Sparkles as PassIcon,
  Ticket as TicketIcon,
  ScanLine as ScanIcon,
  User as ProfileIcon,
  Bell as NotificationIcon,
  Search as SearchIcon,
  ArrowLeft as BackIcon,
  ChevronRight as NextIcon,
  Share2 as ShareIcon,
  CalendarDays as DateIcon,
  Clock as TimeIcon,
  MapPin as PlaceIcon,
  Flame as HotIcon,
  Heart as FollowIcon,
  Users as AudienceIcon,
  Plus as AddIcon,
  Minus as RemoveIcon,
  Pencil as EditIcon,
  Trash2 as DeleteIcon,
  Check as DoneIcon,
  X as CloseIcon,
  Image as PosterIcon,
  Megaphone as CampaignIcon,
  Wallet as RevenueIcon,
  TrendingUp as TrendIcon,
  Store as OrganizerIcon,
  Music as CategoryIcon,
  Globe as LocaleIcon,
  Copy as CopyIcon,
  Smile as StickerIcon,
  LoaderCircle as LoadingIcon,
  QrCode as QrIcon,
  Gift as GiftIcon,
  Smartphone as MobileMoneyIcon,
  Hourglass as PendingIcon,
  TriangleAlert as AlertIcon,
  Star as PointsIcon,
  Settings as SettingsIcon,
  LogOut as SignOutIcon,
  Wrench as AdminIcon,
} from "lucide-react";
