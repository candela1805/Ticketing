namespace Ticket.DTOs;

public class CreateEventRequest
{
    public string Name { get; set; } = string.Empty;
    public DateTime EventDate { get; set; }
    public string Venue { get; set; } = string.Empty;
    public List<CreateSectorRequest> Sectors { get; set; } = [];
}

public class CreateSectorRequest
{
    public string Name { get; set; } = string.Empty;
    public decimal Price { get; set; }
    public int Capacity { get; set; }
}
