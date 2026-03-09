interface InviteStatus {
  status: "banned" | "disabled" | "invalid" | "full" | "error";
  boardName?: string;
}

export const InviteStatus = ({ status, boardName }: InviteStatus) => {
  const messages = {
    banned: {
      title: "You are banned",
      message: `You were banned from ${boardName}.`,
    },
    disabled: {
      title: "Invite disabled",
      message: "This board is not accepting new members.",
    },
    invalid: {
      title: "Invalid invite",
      message: "This invite link is not valid.",
    },
    full: {
      title: "Board full",
      message: "This board has no available slots.",
    },
    error: {
      title: "Error",
      message: "There's been an error",
    },
  };

  const { title, message } = messages[status];

  return (
    <div className="h-full flex items-center justify-center p-8">
      <div className="bg-theme-bg-primary p-6 rounded-lg shadow-md max-w-sm text-center">
        <h1 className="text-xl font-bold text-theme-text-primary">{title}</h1>
        <p className="text-sm text-theme-text-tertiary mt-2">{message}</p>
      </div>
    </div>
  );
};
